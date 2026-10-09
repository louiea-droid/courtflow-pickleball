// Firestore rules for member-readable, manager-published club announcements.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "announcements-test",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anonymous = env.unauthenticatedContext().firestore();
const owner = real("owner");
const manager = real("manager");
const member = real("member");
const stranger = real("stranger");
const postRef = (db, id = "one") => doc(db, `clubs/public/announcements/${id}`);
const post = (extra = {}) => ({
  authorId: "manager",
  authorName: "Club Manager",
  text: "Court maintenance on Saturday.",
  createdAt: Date.now(),
  ...extra,
});

await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/public"), { name: "Public club", visibility: "public", ownerId: "owner" });
  await setDoc(doc(db, "clubs/private"), { name: "Private club", visibility: "private", ownerId: "owner" });
  for (const clubId of ["public", "private"]) {
    await setDoc(doc(db, `clubs/${clubId}/members/owner`), { role: "owner", name: "Club Owner" });
    await setDoc(doc(db, `clubs/${clubId}/members/manager`), { role: "manager", name: "Club Manager" });
    await setDoc(doc(db, `clubs/${clubId}/members/member`), { role: "member", name: "Club Member" });
  }
});

await assertSucceeds(setDoc(postRef(manager), post()));
await assertSucceeds(setDoc(postRef(owner, "owner-post"), post({ authorId: "owner", authorName: "Club Owner" })));
await assertSucceeds(getDoc(postRef(member)));
await assertSucceeds(getDocs(collection(member, "clubs/public/announcements")));
await assertFails(getDoc(postRef(stranger)));
await assertFails(getDocs(collection(stranger, "clubs/public/announcements")));
await assertFails(getDoc(postRef(anonymous)));
await assertFails(getDoc(doc(stranger, "clubs/private/announcements/missing")));
await assertFails(setDoc(postRef(member, "member-post"), post({ authorId: "member", authorName: "Club Member" })));
await assertFails(setDoc(postRef(manager, "wrong-author"), post({ authorId: "owner" })));
await assertFails(setDoc(postRef(manager, "spoofed-name"), post({ authorName: "Club Owner" })));
await assertFails(setDoc(postRef(manager, "too-long"), post({ text: "x".repeat(2001) })));
await assertFails(setDoc(postRef(manager, "empty"), post({ text: "" })));
await assertFails(setDoc(postRef(manager, "extra-field"), post({ extra: true })));
await assertFails(setDoc(postRef(manager, "stale"), post({ createdAt: Date.now() - 86400000 })));
await assertSucceeds(setDoc(doc(manager, "clubs/private/announcements/hidden"), post()));
await assertFails(updateDoc(postRef(manager), { text: "Edited" }));
await assertFails(deleteDoc(postRef(member)));
await assertSucceeds(deleteDoc(postRef(manager)));

await env.cleanup();
console.log("announcements.test: ok");
