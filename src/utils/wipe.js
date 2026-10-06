import { getDocs, limit, query, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

// Deletes every document in a collection. Firestore batches cap at 500 writes,
// so go in rounds until it's empty.
export async function wipeCollection(colRef) {
  for (;;) {
    const snap = await getDocs(query(colRef, limit(400)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
