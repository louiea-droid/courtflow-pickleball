// Firestore rules for volunteer umpires: registering with the link code, claiming one court, scoring only it.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const rules = fs.readFileSync("firestore.rules", "utf8");
// emulators:exec exports FIRESTORE_EMULATOR_HOST; fall back to the default port when run by hand
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const env = await initializeTestEnvironment({ projectId: "umpire-test", firestore: { rules, host, port: Number(port) } });
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const signedOut = env.unauthenticatedContext().firestore();
const v1 = anon("v1"), v2 = anon("v2"), nobody = anon("s1"), mgr = real("mgr"), owner = anon("own1");
const CODE = "AAAA2222";
const score = (extra = {}) => ({ start: 111, t1: 1, t2: 0, serving: 1, server: 2, style: "sideout", to: 11, singles: false, log: [], ...extra });
const E = "clubs/pub/events/ev1"; // a live game
const S = "sessions/own1"; // a quick session

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "clubs/pub"), { name: "pub", nameLower: "pub", visibility: "public", ownerId: "own", createdAt: 1 });
    await setDoc(doc(db, "clubs/pub/members/mgr"), { role: "manager", name: "mgr", joinedAt: 1 });
    for (const [id, status] of [["ev1", "live"], ["ev2", "ended"]]) {
      await setDoc(doc(db, `clubs/pub/events/${id}`), { title: id, status, date: "2026-10-13" });
      await setDoc(doc(db, `clubs/pub/events/${id}/private/umpire`), { code: CODE, style: "sideout", to: 11 });
      for (const c of ["c1", "c2"]) await setDoc(doc(db, `clubs/pub/events/${id}/courts/${c}`), { courtNumber: 1, start: 111, teamA: ["p1"], teamB: ["p2"] });
      await setDoc(doc(db, `clubs/pub/events/${id}/players/p1`), { name: "Ana" });
      await setDoc(doc(db, `clubs/pub/events/${id}/matchLog/m1`), { court: "Court 1" });
    }
    await setDoc(doc(db, S), { location: "Quick", umpireOn: true });
    await setDoc(doc(db, `${S}/private/umpire`), { code: CODE, style: "sideout", to: 11 });
    await setDoc(doc(db, `${S}/courts/c1`), { courtNumber: 1, start: 111, teamA: ["p1"], teamB: ["p2"] });
    await setDoc(doc(db, `${S}/courts/c2`), { courtNumber: 2, start: 111, teamA: [], teamB: [] });
  });
}
const join = (db, base, uid, extra = {}) => setDoc(doc(db, `${base}/umpires/${uid}`), { code: CODE, name: "Sam", at: Date.now(), ...extra });

for (const base of [E, S]) {
  // ---- Registering: the current code, your own uid, a name, nothing else
  await seed();
  await assertSucceeds(join(v1, base, "v1"));
  await seed(); await assertFails(join(v1, base, "v1", { code: "WRONG222" }));
  await assertFails(join(v1, base, "v2")); // someone else's uid
  await assertFails(join(v1, base, "v1", { name: "" }));
  await assertFails(join(v1, base, "v1", { extra: 1 }));
  await assertFails(join(signedOut, base, "v1"));
  // ---- Before registering (or after a stranger): no settings, no claims, no courts' score
  await assertFails(getDoc(doc(nobody, `${base}/private/umpire`)));
  await assertFails(getDocs(collection(nobody, `${base}/courtClaims`)));
  await assertFails(getDocs(collection(nobody, `${base}/umpires`)));
  // ---- A registered umpire reads the settings, claims, and the player list
  await join(v1, base, "v1"); await join(v2, base, "v2");
  await assertSucceeds(getDoc(doc(v1, `${base}/private/umpire`)));
  await assertSucceeds(getDocs(collection(v1, `${base}/courtClaims`)));
  await assertSucceeds(getDoc(doc(v1, `${base}/umpires/v1`))); // own record
  await assertFails(getDoc(doc(v1, `${base}/umpires/v2`))); // not someone else's
  await assertFails(getDocs(collection(v1, `${base}/umpires`)));
  // ---- One umpire per court: the claim is a create, so the second one is refused
  await assertSucceeds(setDoc(doc(v1, `${base}/courtClaims/c1`), { uid: "v1", name: "Sam" }));
  await assertFails(setDoc(doc(v2, `${base}/courtClaims/c1`), { uid: "v2", name: "Lee" }));
  await assertFails(setDoc(doc(v2, `${base}/courtClaims/c2`), { uid: "v1", name: "Sam" })); // not as someone else
  await assertFails(setDoc(doc(v2, `${base}/courtClaims/c2`), { uid: "v2", name: "Lee", extra: 1 }));
  await assertFails(setDoc(doc(nobody, `${base}/courtClaims/c2`), { uid: "s1", name: "x" })); // not registered
  // ---- Scoring: only the court you hold, only the score field, a valid shape
  await assertSucceeds(updateDoc(doc(v1, `${base}/courts/c1`), { score: score() }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c2`), { score: score() })); // not claimed
  await assertFails(updateDoc(doc(v2, `${base}/courts/c1`), { score: score() })); // someone else's court
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { teamA: [] }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: score(), teamA: [] }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: score({ t1: -1 }) }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: score({ evil: 1 }) }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: "11-0" }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: score({ log: new Array(51).fill({}) }) }));
  await assertFails(setDoc(doc(v1, `${base}/players/p9`), { name: "x" })); // nothing else is writable
  if (base === E) await assertFails(getDocs(collection(v1, `${base}/matchLog`))); // (a quick session's match log is public to read, as the Live Board needs)
  // ---- Release: the holder, not another umpire
  await assertFails(deleteDoc(doc(v2, `${base}/courtClaims/c1`)));
  await assertSucceeds(deleteDoc(doc(v1, `${base}/courtClaims/c1`)));
}

// ---- Events: managers read the registrations, release and assign; a stranger reads nothing
await seed(); await join(v1, E, "v1"); await join(v2, E, "v2");
await setDoc(doc(v1, `${E}/courtClaims/c1`), { uid: "v1", name: "Sam" });
await assertSucceeds(getDocs(collection(mgr, `${E}/umpires`)));
await assertSucceeds(setDoc(doc(mgr, `${E}/courtClaims/c1`), { uid: "v2", name: "Lee" })); // assign
await assertFails(updateDoc(doc(v1, `${E}/courts/c1`), { score: score() })); // v1 lost it
await assertSucceeds(updateDoc(doc(v2, `${E}/courts/c1`), { score: score() }));
await assertSucceeds(deleteDoc(doc(mgr, `${E}/courtClaims/c1`)));
// The host renews the link: old registrations stop working at once.
await assertSucceeds(setDoc(doc(v2, `${E}/courtClaims/c1`), { uid: "v2", name: "Lee" }));
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `${E}/private/umpire`), { code: "BBBB3333", style: "sideout", to: 11 }));
await assertFails(updateDoc(doc(v2, `${E}/courts/c1`), { score: score() }));
await assertFails(getDoc(doc(v2, `${E}/private/umpire`)));
await assertFails(getDocs(collection(v2, `${E}/players`)));
await assertFails(setDoc(doc(anon("v3"), `${E}/umpires/v3`), { code: CODE, name: "Old", at: 1 })); // the old link
// An ended game refuses scoring and new umpires.
await seed(); await join(v1, E, "v1");
await setDoc(doc(v1, `${E}/courtClaims/c1`), { uid: "v1", name: "Sam" });
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), E), { title: "ev1", status: "ended", date: "2026-10-13" }));
await assertFails(updateDoc(doc(v1, `${E}/courts/c1`), { score: score() }));
await assertFails(join(v2, E, "v2"));
await seed(); await assertFails(join(v1, "clubs/pub/events/ev2", "v1")); // registering on an ended game

// ---- Quick session: the owner decides (umpireOn), the code and registrations are private, the owner manages them
await seed();
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), S), { location: "Quick", umpireOn: false }));
await assertFails(join(v1, S, "v1"));
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), S), { location: "Quick", umpireOn: true }));
await assertSucceeds(join(v1, S, "v1"));
await assertFails(getDoc(doc(signedOut, `${S}/private/umpire`))); // sessions are public to read, this is not
await assertFails(getDocs(collection(signedOut, `${S}/umpires`)));
await assertFails(getDocs(collection(signedOut, `${S}/courtClaims`)));
await assertSucceeds(getDocs(collection(signedOut, `${S}/courts`))); // the Live Board keeps working
await assertSucceeds(getDoc(doc(owner, `${S}/private/umpire`)));
await assertSucceeds(getDocs(collection(owner, `${S}/umpires`)));
await assertSucceeds(setDoc(doc(owner, `${S}/courtClaims/c1`), { uid: "v1", name: "Sam" }));
await assertSucceeds(updateDoc(doc(v1, `${S}/courts/c1`), { score: score() }));
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), S), { location: "Quick", umpireOn: false }));
await assertFails(updateDoc(doc(v1, `${S}/courts/c1`), { score: score() })); // the owner turned it off

await env.cleanup();
console.log("umpire rules passed");
