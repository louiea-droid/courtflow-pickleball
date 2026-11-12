import { collection, doc, getDocs, writeBatch } from "firebase/firestore";

// Feed writes shared by the hooks and the club delete cascade. The db is passed in so tests can run this.
export const postRef = (db, clubId, id) => doc(db, "clubs", clubId, "announcements", id);

// A post with its replies and photo, in one batch (the rules let a reply or photo go without the count only when the
// post goes with it). ponytail: one batch holds 500 writes, so about 490 replies; page it if threads grow that long.
export async function deletePostBatch(db, clubId, postId) {
  const ref = postRef(db, clubId, postId);
  const replies = await getDocs(collection(ref, "replies"));
  const batch = writeBatch(db);
  replies.forEach((r) => batch.delete(r.ref));
  batch.delete(doc(ref, "photo", "main"));
  batch.delete(ref);
  await batch.commit();
}
