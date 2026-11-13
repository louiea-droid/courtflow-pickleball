// Firestore rules for profile pictures: avatars/{uid} = { image } (JPEG data URL, <= 12000) or { builtin } ("a1".."a12").
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "avatar-test",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});
const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anon = env.authenticatedContext("anon", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const signedOut = env.unauthenticatedContext().firestore();
const me = real("me");
const other = real("other");
const P = "data:image/jpeg;base64,";
const jpeg = (n) => P + "A".repeat(n - P.length);
const at = serverTimestamp();

await env.clearFirestore();
const mine = doc(me, "avatars/me");

// Your own: an uploaded photo or a built-in, never both, never too big or not JPEG.
await assertSucceeds(setDoc(mine, { image: jpeg(12000), updatedAt: at }));
await assertFails(setDoc(mine, { image: jpeg(12001), updatedAt: at }));
await assertFails(setDoc(mine, { image: "data:image/png;base64,AAAA", updatedAt: at }));
await assertFails(setDoc(mine, { image: P + 'AA")', updatedAt: at }));
await assertSucceeds(setDoc(mine, { builtin: "a12", updatedAt: at }));
await assertFails(setDoc(mine, { builtin: "a13", updatedAt: at }));
await assertFails(setDoc(mine, { builtin: "a1", image: jpeg(100), updatedAt: at }));
await assertFails(setDoc(mine, { builtin: "a1", updatedAt: at, extra: 1 }));
await assertFails(setDoc(mine, { builtin: "a1" }));
await assertFails(setDoc(mine, { builtin: "a1", updatedAt: 5 }));

// Nobody else writes or deletes it; anonymous screens can't write their own either.
await assertFails(setDoc(doc(other, "avatars/me"), { builtin: "a2", updatedAt: at }));
await assertFails(deleteDoc(doc(other, "avatars/me")));
await assertFails(setDoc(doc(anon, "avatars/anon"), { builtin: "a2", updatedAt: at }));

// Any signed-in account reads one by id; no listing, no signed-out or anonymous reads.
await assertSucceeds(getDoc(doc(other, "avatars/me")));
await assertSucceeds(getDoc(doc(other, "avatars/nobody")));
await assertFails(getDocs(collection(other, "avatars")));
await assertFails(getDoc(doc(signedOut, "avatars/me")));
await assertFails(getDoc(doc(anon, "avatars/me")));

await assertSucceeds(deleteDoc(mine));
console.log("avatar.test: ok");
await env.cleanup();
