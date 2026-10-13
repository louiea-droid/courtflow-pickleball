// Firestore rules for a game's Live Board (a TV registers with the link key) and the booking page's live strip.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const rules = fs.readFileSync("firestore.rules", "utf8");
// emulators:exec exports FIRESTORE_EMULATOR_HOST; fall back to the default port when run by hand
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const env = await initializeTestEnvironment({ projectId: "live-test", firestore: { rules, host, port: Number(port) } });
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const signedOut = env.unauthenticatedContext().firestore();
const tv = anon("tv1"), tv2 = anon("tv2"), mgr = real("mgr");
const HOUR = 3600000;
const now = Date.now();

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [club, visibility] of [["pub", "public"], ["priv", "private"]]) {
      await setDoc(doc(db, `clubs/${club}`), { name: club, nameLower: club, visibility, ownerId: "own", createdAt: 1 });
      await setDoc(doc(db, `clubs/${club}/members/mgr`), { role: "manager", name: "mgr", joinedAt: 1 });
      const events = { ev1: { status: "live" }, ev2: { status: "ended", endedAt: now - HOUR }, ev3: { status: "ended", endedAt: now - 13 * HOUR } };
      for (const [id, extra] of Object.entries(events)) {
        const e = `clubs/${club}/events/${id}`;
        await setDoc(doc(db, e), { title: id, date: "2026-10-13", clubPublic: visibility === "public", ...extra });
        await setDoc(doc(db, `${e}/private/live`), { key: "KEY1", title: id });
        await setDoc(doc(db, `${e}/courts/c1`), { courtNumber: 1, start: 1, teamA: ["p1"], teamB: ["p2"], score: { start: 1, t1: 3, t2: 1 } });
        await setDoc(doc(db, `${e}/players/p1`), { name: "Ana", createdAt: 1 });
        await setDoc(doc(db, `${e}/matchLog/m1`), { court: "Court 1", recordedAt: 1 });
        await setDoc(doc(db, `${e}/costs/x1`), { label: "Court", total: 10 });
      }
    }
  });
}
const ev = (club = "pub", id = "ev1") => `clubs/${club}/events/${id}`;
const join = (db, path, uid, extra = {}) => setDoc(doc(db, `${path}/viewers/${uid}`), { key: "KEY1", at: now, ...extra });
const reads = (db, path) => [getDocs(collection(db, `${path}/players`)), getDocs(collection(db, `${path}/courts`)), getDocs(collection(db, `${path}/matchLog`)), getDoc(doc(db, `${path}/private/live`))];

// ---- Registering a screen: the current key, your own uid, nothing else
await seed();
await assertFails(join(tv, ev(), "tv1", { key: "WRONG" }));
await assertFails(join(tv, ev(), "tv2")); // someone else's uid
await assertFails(join(tv, ev(), "tv1", { extra: 1 }));
await assertFails(join(signedOut, ev(), "tv1"));
for (const r of reads(tv, ev("priv"))) await assertFails(r); // not registered: nothing (a public club's courts are open, below)
await assertSucceeds(join(tv, ev(), "tv1"));
// ---- A registered screen reads the game, never the costs, and writes nothing
await assertSucceeds(getDocs(collection(tv, `${ev()}/players`)));
await assertSucceeds(getDocs(collection(tv, `${ev()}/courts`)));
await assertSucceeds(getDocs(collection(tv, `${ev()}/matchLog`)));
await assertSucceeds(getDoc(doc(tv, `${ev()}/private/live`)));
await assertSucceeds(getDoc(doc(tv, `${ev()}/viewers/tv1`)));
await assertFails(getDocs(collection(tv, `${ev()}/costs`)));
await assertFails(getDocs(collection(tv, `${ev()}/viewers`))); // not the other screens
await assertFails(getDoc(doc(tv, `${ev()}/private/umpire`)));
await assertFails(updateDoc(doc(tv, `${ev()}/courts/c1`), { score: { start: 1, t1: 9, t2: 1 } }));
await assertFails(setDoc(doc(tv, `${ev()}/players/p9`), { name: "x" }));
await assertFails(updateDoc(doc(tv, `${ev()}/viewers/tv1`), { key: "KEY1", at: now + 1 })); // no updates, only create / delete

// ---- A private club: the board works without the event or club documents
await assertSucceeds(join(tv, ev("priv"), "tv1"));
for (const r of reads(tv, ev("priv"))) await assertSucceeds(r);
await assertFails(getDoc(doc(tv, ev("priv")))); // the event doc (payment details) stays members-only
await assertFails(getDoc(doc(tv, "clubs/priv")));

// ---- After End game: 12 hours of final results, then nothing
await assertSucceeds(join(tv, ev("pub", "ev2"), "tv1"));
await assertSucceeds(getDocs(collection(tv, `${ev("pub", "ev2")}/courts`)));
await assertFails(join(tv, ev("pub", "ev3"), "tv1"));
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `${ev("priv", "ev3")}/viewers/tv1`), { key: "KEY1", at: now - 14 * HOUR }));
await assertFails(getDocs(collection(tv, `${ev("priv", "ev3")}/players`)));

// ---- New link: every registered screen stops at once, the old link can't register, a screen re-registers with the new key
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `${ev()}/private/live`), { key: "KEY2", title: "ev1" }));
await assertFails(getDocs(collection(tv, `${ev()}/players`)));
await assertFails(join(tv2, ev(), "tv2")); // old key
await assertSucceeds(deleteDoc(doc(tv, `${ev()}/viewers/tv1`))); // its own stale record
await assertSucceeds(join(tv, ev(), "tv1", { key: "KEY2" }));
await assertSucceeds(getDocs(collection(tv, `${ev()}/players`)));

// ---- Managers make the link and see the screens
await seed();
await assertSucceeds(setDoc(doc(mgr, `${ev()}/private/live`), { key: "NEW", title: "ev1" }));
await assertSucceeds(getDocs(collection(mgr, `${ev()}/viewers`)));

// ---- Booking page: a public club's courts (ids and scores only) are readable by anyone; a private club's are not
await seed();
await assertSucceeds(getDocs(collection(signedOut, `${ev()}/courts`)));
await assertSucceeds(getDocs(collection(anon("x"), `${ev()}/courts`)));
await assertFails(getDocs(collection(signedOut, `${ev("priv")}/courts`)));
await assertFails(getDocs(collection(signedOut, `${ev()}/players`)));
await assertFails(getDocs(collection(signedOut, `${ev()}/matchLog`)));

await env.cleanup();
console.log("live rules passed");
