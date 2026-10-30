// Firestore rules for voice recordings (clubs/{c}/voice) and the Live Board pointer (clubs/{c}/boardViewers).
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";

const rules = fs.readFileSync("firestore.rules", "utf8");
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const env = await initializeTestEnvironment({ projectId: "voice-test", firestore: { rules, host, port: Number(port) } });
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const signedOut = env.unauthenticatedContext().firestore();
const mgr = real("mgr"), member = real("mem"), owner = real("own"), tv = anon("tv1"), stranger = anon("tv2");
const now = Date.now();
const clip = (extra = {}) => ({ audio: "data:audio/webm;codecs=opus;base64,AAAA", label: "next up", at: now, ...extra });

await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/c1"), { name: "c1", nameLower: "c1", visibility: "public", ownerId: "own", createdAt: 1 });
  await setDoc(doc(db, "clubs/c1/members/own"), { role: "owner", name: "own", joinedAt: 1 });
  await setDoc(doc(db, "clubs/c1/members/mgr"), { role: "manager", name: "mgr", joinedAt: 1 });
  await setDoc(doc(db, "clubs/c1/members/mem"), { role: "member", name: "mem", joinedAt: 1 });
  for (const [id, extra] of Object.entries({ live: { status: "live" }, old: { status: "ended", endedAt: now - 13 * 3600000 } })) {
    await setDoc(doc(db, `clubs/c1/events/${id}`), { title: id, date: "2026-10-30", clubPublic: true, ...extra });
    await setDoc(doc(db, `clubs/c1/events/${id}/private/live`), { key: "KEY1" });
    await setDoc(doc(db, `clubs/c1/events/${id}/viewers/tv1`), { key: "KEY1", at: now });
  }
  await setDoc(doc(db, "clubs/c1/voice/p_and"), clip({ label: "and" }));
});
const voice = (db) => getDocs(collection(db, "clubs/c1/voice"));
const put = (db, id = "p_next-up", data = clip()) => setDoc(doc(db, `clubs/c1/voice/${id}`), data);

// ---- Recording: managers only, a valid clip only
await assertSucceeds(put(mgr));
await assertSucceeds(put(owner, "n_ana"));
await assertFails(put(member));
await assertFails(put(tv));
await assertFails(put(signedOut));
await assertFails(put(mgr, "x", clip({ audio: "data:image/jpeg;base64,AAAA" }))); // not audio
await assertFails(put(mgr, "x", clip({ audio: `data:audio/webm;base64,${"A".repeat(100000)}` }))); // too long
await assertFails(put(mgr, "x", clip({ extra: 1 })));
await assertFails(put(mgr, "x", { audio: clip().audio, label: "x" })); // no time
await assertFails(deleteDoc(doc(member, "clubs/c1/voice/p_and")));

// ---- Reading: managers, and a Live Board screen pointing at a live game it is registered for
await assertSucceeds(voice(mgr));
await assertFails(voice(member));
await assertFails(voice(tv)); // no pointer yet
await assertFails(voice(signedOut));
await assertFails(setDoc(doc(tv, "clubs/c1/boardViewers/tv2"), { event: "live" })); // someone else's pointer
await assertFails(setDoc(doc(tv, "clubs/c1/boardViewers/tv1"), { event: "live", extra: 1 }));
await assertSucceeds(setDoc(doc(tv, "clubs/c1/boardViewers/tv1"), { event: "live" }));
await assertSucceeds(voice(tv));
await assertFails(put(tv)); // still read-only
await assertSucceeds(setDoc(doc(tv, "clubs/c1/boardViewers/tv1"), { event: "old" })); // a game over for 12+ hours
await assertFails(voice(tv));
await assertSucceeds(setDoc(doc(stranger, "clubs/c1/boardViewers/tv2"), { event: "live" })); // not registered there
await assertFails(voice(stranger));

// ---- Cleaning up: the owner lists and deletes pointers (deleting the club); others can't list them
await assertFails(getDocs(collection(mgr, "clubs/c1/boardViewers")));
await assertSucceeds(getDocs(collection(owner, "clubs/c1/boardViewers")));
await assertSucceeds(deleteDoc(doc(owner, "clubs/c1/boardViewers/tv1")));
await assertSucceeds(deleteDoc(doc(mgr, "clubs/c1/voice/p_and")));

await env.cleanup();
console.log("voice rules ok");
