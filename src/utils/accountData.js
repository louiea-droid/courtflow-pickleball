import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { wipeCollection } from "./wipe.js";

// Subcollections under each event. Step 3 adds players, courts, matchLog and costs.
export const EVENT_SUBCOLLECTIONS = ["requests"];

// Erases everything an account owns: each event's subcollections first (they would
// otherwise be orphaned when the event doc goes), then events, roster, and the
// account doc itself. Data first; the caller deletes the sign-in last.
export async function deleteAccountData(db, uid) {
  const events = await getDocs(collection(db, "accounts", uid, "events"));
  for (const e of events.docs) {
    for (const name of EVENT_SUBCOLLECTIONS) await wipeCollection(db, collection(e.ref, name));
  }
  await wipeCollection(db, collection(db, "accounts", uid, "events"));
  await wipeCollection(db, collection(db, "accounts", uid, "roster"));
  const batch = writeBatch(db);
  batch.delete(doc(db, "accounts", uid));
  await batch.commit();
}
