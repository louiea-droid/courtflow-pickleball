import { collection, deleteDoc, doc, getDoc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { wipeCollection } from "./wipe.js";

// Subcollections under each event: join requests, and the game's players, courts, matchLog
// and costs. Listed here so deleting an event, a club or an account never orphans any of them.
export const EVENT_SUBCOLLECTIONS = ["requests", "players", "courts", "matchLog", "costs"];

// Subcollections directly under a club (events have their own cascade; members are handled in order).
export const CLUB_SUBCOLLECTIONS = ["roster", "joinRequests", "private"];

// Deletes one event and everything under it. The event doc goes first, so the rules refuse any
// new join request at once (they check the event exists) and nothing can slip in while the
// subcollections are cleared, which then run in parallel.
export async function deleteEventData(db, clubId, eventId) {
  const ref = doc(db, "clubs", clubId, "events", eventId);
  await deleteDoc(ref);
  await Promise.all(EVENT_SUBCOLLECTIONS.map((name) => wipeCollection(db, collection(ref, name))));
}

// Deletes a club and everything in it. Run as the club's owner. The order matters for the rules:
// everything else first (the owner's member record is what grants the right to delete it), then
// the club doc, then the owner's own member record (allowed once the club is gone), then the
// owner's "My clubs" copy.
export async function deleteClubData(db, clubId, ownerId) {
  const ref = doc(db, "clubs", clubId);
  // A delete that was interrupted can leave the owner's record and "My clubs" copy behind with the
  // club already gone; the owner can no longer list its events, so just finish the leftovers.
  if (!(await getDoc(ref)).exists()) {
    await deleteDoc(doc(ref, "members", ownerId));
    await deleteDoc(doc(db, "accounts", ownerId, "memberships", clubId));
    return;
  }
  const events = await getDocs(collection(ref, "events"));
  // Subcollections first, the event doc last: if this stops midway the event is still listed, so a
  // retry finds it (deleting the doc first would orphan its requests, which hold phone numbers).
  // ponytail: a join request could land between the wipe and the event delete; the club doc is deleted right after, so the window is seconds.
  await Promise.all(events.docs.map(async (e) => {
    await Promise.all(EVENT_SUBCOLLECTIONS.map((name) => wipeCollection(db, collection(e.ref, name))));
    await deleteDoc(e.ref);
  }));
  await Promise.all(CLUB_SUBCOLLECTIONS.map((name) => wipeCollection(db, collection(ref, name))));
  const members = await getDocs(collection(ref, "members"));
  const others = writeBatch(db);
  // ponytail: one batch holds 500 writes, so about 250 members; chunk it if a club grows past that.
  members.docs.filter((m) => m.id !== ownerId).forEach((m) => {
    others.delete(m.ref);
    others.delete(doc(db, "accounts", m.id, "memberships", clubId)); // their "My clubs" card goes with the club
  });
  await others.commit();
  await deleteDoc(ref);
  await deleteDoc(doc(ref, "members", ownerId));
  await deleteDoc(doc(db, "accounts", ownerId, "memberships", clubId));
}

// Leaves a club the person only belongs to: their member record, then their "My clubs" card. Safe to
// run when the record was already removed or the club is gone (a person can always read their own
// record). A real failure rejects before the card goes, so nobody is left as a ghost member.
export async function leaveClub(db, clubId, uid) {
  const ref = doc(db, "clubs", clubId, "members", uid);
  if ((await getDoc(ref)).exists()) await deleteDoc(ref);
  await deleteDoc(doc(db, "accounts", uid, "memberships", clubId));
}

// The friend directory: this person's name listing, friend code and friendships (never anyone else's).
// The code document is only deleted when it exists and is theirs (the rules refuse a delete of anything else).
async function deleteFriendData(db, uid) {
  const account = (await getDoc(doc(db, "accounts", uid))).data() || {};
  const mine = await getDocs(query(collection(db, "friendships"), where("users", "array-contains", uid)));
  // A batch holds 500 writes: friendships go in chunks, the listing and the code in the last one.
  for (let i = 0; i < mine.docs.length; i += 400) {
    const chunk = writeBatch(db);
    mine.docs.slice(i, i + 400).forEach((f) => chunk.delete(f.ref));
    await chunk.commit();
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, "profiles", uid));
  if (account.friendCode) {
    const codeRef = doc(db, "friendCodes", account.friendCode);
    if ((await getDoc(codeRef)).data()?.uid === uid) batch.delete(codeRef);
  }
  await batch.commit();
}

// Events and roster that older versions kept directly under an account.
async function deleteLegacyData(db, uid) {
  const events = await getDocs(collection(db, "accounts", uid, "events"));
  await Promise.all(events.docs.map(async (e) => {
    await deleteDoc(e.ref);
    await Promise.all(EVENT_SUBCOLLECTIONS.map((name) => wipeCollection(db, collection(e.ref, name))));
  }));
  await wipeCollection(db, collection(db, "accounts", uid, "roster"));
}

// Erases everything an account owns. Clubs the person only belongs to are left first (no ghost
// member stays behind), then each club it owns (with everything in it), its "My clubs" copies, any
// friend directory entries and friendships, data from before clubs, and the account doc itself. Data first; the caller deletes the sign-in last.
export async function deleteAccountData(db, uid) {
  const memberships = await getDocs(collection(db, "accounts", uid, "memberships"));
  const owned = memberships.docs.filter((m) => m.data().role === "owner");
  const joined = memberships.docs.filter((m) => m.data().role !== "owner");
  await Promise.all(joined.map((m) => leaveClub(db, m.id, uid)));
  await Promise.all(owned.map((m) => deleteClubData(db, m.id, uid)));
  await wipeCollection(db, collection(db, "accounts", uid, "memberships"));
  await deleteFriendData(db, uid);
  await deleteLegacyData(db, uid);
  const batch = writeBatch(db);
  batch.delete(doc(db, "accounts", uid));
  await batch.commit();
}
