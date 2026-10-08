import { collection, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore";
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
  const events = await getDocs(collection(ref, "events"));
  await Promise.all(events.docs.map((e) => deleteEventData(db, clubId, e.id)));
  await Promise.all(CLUB_SUBCOLLECTIONS.map((name) => wipeCollection(db, collection(ref, name))));
  const members = await getDocs(collection(ref, "members"));
  const others = writeBatch(db);
  members.docs.filter((m) => m.id !== ownerId).forEach((m) => others.delete(m.ref));
  await others.commit();
  await deleteDoc(ref);
  await deleteDoc(doc(ref, "members", ownerId));
  await deleteDoc(doc(db, "accounts", ownerId, "memberships", clubId));
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

// Erases everything an account owns: each club it owns (with everything in it), its "My clubs"
// copies, any data from before clubs, and the account doc itself. Data first; the caller deletes
// the sign-in last. Clubs the person only belongs to are left as they are (a later part adds leaving).
export async function deleteAccountData(db, uid) {
  const memberships = await getDocs(collection(db, "accounts", uid, "memberships"));
  const owned = memberships.docs.filter((m) => m.data().role === "owner");
  await Promise.all(owned.map((m) => deleteClubData(db, m.id, uid)));
  await wipeCollection(db, collection(db, "accounts", uid, "memberships"));
  await deleteLegacyData(db, uid);
  const batch = writeBatch(db);
  batch.delete(doc(db, "accounts", uid));
  await batch.commit();
}
