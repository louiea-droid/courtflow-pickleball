import { collection, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore";
import { wipeCollection } from "./wipe.js";

// Subcollections under each event: join requests, and the game's players, courts, matchLog
// and costs. Listed here so deleting an event or an account never orphans any of them.
export const EVENT_SUBCOLLECTIONS = ["requests", "players", "courts", "matchLog", "costs"];

// Deletes one event and everything under it. The event doc goes first, so the rules refuse any
// new join request at once (they check the event exists) and nothing can slip in while the
// subcollections are cleared, which then run in parallel.
export async function deleteEventData(db, uid, eventId) {
  const ref = doc(db, "accounts", uid, "events", eventId);
  await deleteDoc(ref);
  await Promise.all(EVENT_SUBCOLLECTIONS.map((name) => wipeCollection(db, collection(ref, name))));
}

// Erases everything an account owns: every event with its subcollections, the roster, and the
// account doc itself. Data first; the caller deletes the sign-in last.
export async function deleteAccountData(db, uid) {
  const events = await getDocs(collection(db, "accounts", uid, "events"));
  await Promise.all(events.docs.map((e) => deleteEventData(db, uid, e.id)));
  await wipeCollection(db, collection(db, "accounts", uid, "roster"));
  const batch = writeBatch(db);
  batch.delete(doc(db, "accounts", uid));
  await batch.commit();
}
