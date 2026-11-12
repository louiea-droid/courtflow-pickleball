// Firestore rules for the club feed (clubs/{id}/announcements): member posts, manager announcements, a photo per post,
// hearts (your own only), replies (the count moves with them) and deletes. Run: npm run test:rules.
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, increment, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "feed-test",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anonymous = env.unauthenticatedContext().firestore();
const owner = real("owner");
const manager = real("manager");
const member = real("member");
const other = real("other");
const former = real("former");
const stranger = real("stranger");
const P = "data:image/jpeg;base64,";
const jpeg = (n) => P + "A".repeat(n - P.length);
const postRef = (db, id, club = "public") => doc(db, `clubs/${club}/announcements/${id}`);
const replyRef = (db, post, id) => doc(db, `clubs/public/announcements/${post}/replies/${id}`);
const photoRef = (db, post) => doc(db, `clubs/public/announcements/${post}/photo/main`);
const NAMES = { owner: "Club Owner", manager: "Club Manager", member: "Club Member", other: "Other Member" };
const post = (uid, extra = {}) => ({
  authorId: uid, authorName: NAMES[uid], authorRole: uid === "other" ? "member" : uid, text: "See you Thursday.",
  createdAt: Date.now(), announcement: false, hasPhoto: false, hearts: [], replyCount: 0, ...extra,
});
const reply = (uid, extra = {}) => ({ authorId: uid, authorName: NAMES[uid], text: "Count me in.", createdAt: Date.now(), ...extra });

await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/public"), { name: "Public club", visibility: "public", ownerId: "owner" });
  await setDoc(doc(db, "clubs/private"), { name: "Private club", visibility: "private", ownerId: "owner" });
  for (const clubId of ["public", "private"]) {
    await setDoc(doc(db, `clubs/${clubId}/members/owner`), { role: "owner", name: "Club Owner" });
    await setDoc(doc(db, `clubs/${clubId}/members/manager`), { role: "manager", name: "Club Manager" });
    await setDoc(doc(db, `clubs/${clubId}/members/member`), { role: "member", name: "Club Member" });
    await setDoc(doc(db, `clubs/${clubId}/members/other`), { role: "member", name: "Other Member" });
  }
  // Written before the feed: no announcement / hearts / replyCount / authorRole.
  await setDoc(doc(db, "clubs/public/announcements/old"), { authorId: "manager", authorName: "Club Manager", text: "Old news", createdAt: 1 });
  // By someone who has since left the club.
  await setDoc(doc(db, "clubs/public/announcements/gone"), { ...post("member"), authorId: "former", authorName: "Former" });
});

// Reading: members only.
await assertSucceeds(getDoc(postRef(member, "old")));
await assertSucceeds(getDocs(collection(member, "clubs/public/announcements")));
await assertFails(getDocs(collection(stranger, "clubs/public/announcements")));
await assertFails(getDoc(postRef(anonymous, "old")));
await assertFails(getDoc(doc(stranger, "clubs/private/announcements/missing")));

// Posting: every member; announcements only for owners and managers.
await assertSucceeds(setDoc(postRef(member, "m1"), post("member")));
await assertFails(setDoc(postRef(member, "m-ann"), post("member", { announcement: true })));
await assertSucceeds(setDoc(postRef(manager, "a1"), post("manager", { announcement: true })));
await assertSucceeds(setDoc(postRef(owner, "o1"), post("owner", { announcement: true })));
await assertSucceeds(setDoc(postRef(manager, "hidden", "private"), post("manager")));
await assertFails(setDoc(postRef(member, "bad-role"), post("member", { authorRole: "manager" })));
await assertFails(setDoc(postRef(member, "bad-name"), post("member", { authorName: "Club Owner" })));
await assertFails(setDoc(postRef(member, "spaces"), post("member", { text: "   " })));
await assertFails(setDoc(postRef(member, "long"), post("member", { text: "x".repeat(2001) })));
await assertFails(setDoc(postRef(member, "hearted"), post("member", { hearts: ["member"] })));
await assertFails(setDoc(postRef(member, "counted"), post("member", { replyCount: 1 })));
await assertFails(setDoc(postRef(member, "extra"), post("member", { extra: true })));
await assertFails(setDoc(postRef(member, "stale"), post("member", { createdAt: Date.now() - 86400000 })));
await assertFails(setDoc(postRef(member, "other-author"), post("member", { authorId: "other" })));
await assertFails(setDoc(postRef(stranger, "s1"), { ...post("member"), authorId: "stranger" }));
await assertFails(updateDoc(postRef(member, "m1"), { text: "Edited" }));

// A photo: only in the post's create batch, as a JPEG within the limit.
{
  const b = writeBatch(member);
  b.set(postRef(member, "p1"), post("member", { hasPhoto: true }));
  b.set(photoRef(member, "p1"), { image: jpeg(1000) });
  await assertSucceeds(b.commit());
}
await assertFails(setDoc(postRef(member, "p2"), post("member", { hasPhoto: true })));
await assertFails(setDoc(photoRef(member, "m1"), { image: jpeg(1000) }));
{
  const b = writeBatch(member);
  b.set(postRef(member, "p3"), post("member", { hasPhoto: true }));
  b.set(photoRef(member, "p3"), { image: jpeg(380001) });
  await assertFails(b.commit());
}
{
  const b = writeBatch(member);
  b.set(postRef(member, "p4"), post("member", { hasPhoto: false }));
  b.set(photoRef(member, "p4"), { image: jpeg(1000) });
  await assertFails(b.commit());
}
await assertSucceeds(getDoc(photoRef(other, "p1")));
await assertFails(getDoc(photoRef(stranger, "p1")));

// Hearts: your own uid, once.
await assertSucceeds(updateDoc(postRef(member, "a1"), { hearts: arrayUnion("member") }));
await assertSucceeds(updateDoc(postRef(member, "a1"), { hearts: arrayRemove("member") }));
await assertFails(updateDoc(postRef(member, "a1"), { hearts: arrayUnion("manager") }));
await assertFails(updateDoc(postRef(member, "a1"), { hearts: ["member", "member"] }));
await assertFails(updateDoc(postRef(member, "a1"), { hearts: arrayUnion("member"), text: "x" }));
await assertSucceeds(updateDoc(postRef(member, "old"), { hearts: arrayUnion("member") }));
await assertFails(updateDoc(postRef(stranger, "old"), { hearts: arrayUnion("stranger") }));

// Replies move the count in the same batch.
const addReply = (db, uid, postId, id, extra = {}, by = 1) => {
  const b = writeBatch(db);
  b.set(replyRef(db, postId, id), reply(uid, extra));
  b.update(postRef(db, postId), { replyCount: increment(by), lastReplyId: id });
  return b.commit();
};
const dropReply = (db, postId, id, by = -1) => {
  const b = writeBatch(db);
  b.delete(replyRef(db, postId, id));
  b.update(postRef(db, postId), { replyCount: increment(by), lastReplyId: id });
  return b.commit();
};
await assertSucceeds(addReply(other, "other", "m1", "r1"));
await assertFails(setDoc(replyRef(other, "m1", "r2"), reply("other")));
await assertFails(updateDoc(postRef(other, "m1"), { replyCount: increment(1), lastReplyId: "r9" }));
await assertFails(addReply(other, "other", "m1", "r3", {}, 2));
await assertFails(addReply(other, "other", "m1", "r4", { text: "x".repeat(1001) }));
await assertFails(addReply(other, "other", "m1", "r5", { text: "  " }));
await assertFails(addReply(stranger, "member", "m1", "r6"));
await assertSucceeds(addReply(member, "member", "old", "r7"));
await assertSucceeds(addReply(manager, "manager", "a1", "r8"));
await assertSucceeds(addReply(other, "other", "a1", "r9"));

// Deleting a reply: its author, the post's author or a manager, with the count going down.
await assertFails(dropReply(member, "a1", "r9")); // neither the reply's nor the post's author
await assertFails(deleteDoc(replyRef(other, "a1", "r9"))); // count left as it was
await assertSucceeds(dropReply(other, "a1", "r9"));
await assertSucceeds(addReply(other, "other", "m1", "r10"));
await assertSucceeds(dropReply(member, "m1", "r10")); // the post's author tidies their own post
await assertSucceeds(dropReply(manager, "a1", "r8"));

// Deleting a post: one batch with its replies and photo, by the author or a manager.
const dropPost = (db, postId, replies = [], photo = false) => {
  const b = writeBatch(db);
  replies.forEach((r) => b.delete(replyRef(db, postId, r)));
  if (photo) b.delete(photoRef(db, postId));
  b.delete(postRef(db, postId));
  return b.commit();
};
await assertFails(dropPost(other, "m1", ["r1"])); // someone else's post
await assertSucceeds(dropPost(member, "m1", ["r1"]));
await assertFails(dropPost(other, "p1", [], true));
await assertSucceeds(dropPost(manager, "p1", [], true)); // a manager removes a member's post
await assertFails(deleteDoc(postRef(former, "gone"))); // left the club
await assertFails(deleteDoc(photoRef(member, "old"))); // a photo only goes with its post
await assertFails(dropPost(member, "old", ["r7"])); // a member can't delete a manager's post (r7 is theirs)
await assertSucceeds(dropPost(manager, "old", ["r7"]));

await env.cleanup();
console.log("feed.test: ok");
