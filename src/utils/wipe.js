import { getDocs, limit, query, writeBatch } from "firebase/firestore";

// Deletes every document in a collection. Firestore batches cap at 500 writes, so
// go in rounds until it's empty. The db is passed in so this also runs in tests.
export async function wipeCollection(db, colRef) {
  for (;;) {
    const snap = await getDocs(query(colRef, limit(400)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
