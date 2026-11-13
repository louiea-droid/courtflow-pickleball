// Firestore rules for player self check-in (docs/superpowers/specs/2026-11-13-self-checkin-design.md).
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "checkin-test",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const phone = anon("phone");
const late = anon("late");
const E = "clubs/c/events/e";
const now = () => Date.now();
const newPlayer = (id, extra = {}) => ({ id, name: "Ana Cruz", skill: 3, selfRated: true, checked: true, checkedAt: now(), createdAt: now(), games: 0, wins: 0, losses: 0, ...extra });

await env.clearFirestore();
const seed = async (fn) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
await seed(async (db) => {
  await setDoc(doc(db, "clubs/c"), { name: "Club", visibility: "public", ownerId: "owner" });
  await setDoc(doc(db, E), { title: "Open play", status: "live" });
  await setDoc(doc(db, `${E}/private/checkin`), { on: true, code: "4827" });
  await setDoc(doc(db, `${E}/players/rated`), { id: "rated", name: "Gus Lim", skill: 3, checked: false, games: 1 });
  await setDoc(doc(db, `${E}/players/unrated`), { id: "unrated", name: "Bo Santos", checked: false, games: 0 });
  await setDoc(doc(db, `${E}/players/in`), { id: "in", name: "Ivy Tan", skill: 2, checked: true, checkedAt: 5 });
});

// Without registering: nothing.
await assertFails(getDocs(collection(phone, `${E}/players`)));
await assertFails(updateDoc(doc(phone, `${E}/players/rated`), { checked: true, checkedAt: now(), breakAt: null }));

// Registering needs the current code.
await assertFails(setDoc(doc(phone, `${E}/checkins/phone`), { code: "1111", at: now() }));
await assertFails(setDoc(doc(phone, `${E}/checkins/other`), { code: "4827", at: now() }));
await assertFails(setDoc(doc(phone, `${E}/checkins/phone`), { code: "4827", at: now(), extra: 1 }));
await assertSucceeds(setDoc(doc(phone, `${E}/checkins/phone`), { code: "4827", at: now() }));

// Registered: read the players; check a rated player in without touching their stars.
await assertSucceeds(getDocs(collection(phone, `${E}/players`)));
await assertFails(updateDoc(doc(phone, `${E}/players/rated`), { checked: true, checkedAt: now(), breakAt: null, skill: 5, selfRated: true }));
await assertFails(updateDoc(doc(phone, `${E}/players/rated`), { checked: true, checkedAt: now(), breakAt: null, games: 0 }));
await assertFails(updateDoc(doc(phone, `${E}/players/rated`), { checked: true, checkedAt: 1, breakAt: null }));
await assertSucceeds(updateDoc(doc(phone, `${E}/players/rated`), { checked: true, checkedAt: now(), breakAt: null }));
// Already checked in: no second check-in (it would reset their place).
await assertFails(updateDoc(doc(phone, `${E}/players/in`), { checked: true, checkedAt: now(), breakAt: null }));
// An unrated player picks a level.
await assertFails(updateDoc(doc(phone, `${E}/players/unrated`), { checked: true, checkedAt: now(), breakAt: null, skill: 9, selfRated: true }));
await assertSucceeds(updateDoc(doc(phone, `${E}/players/unrated`), { checked: true, checkedAt: now(), breakAt: null, skill: 2, selfRated: true }));
// Nobody checks out or deletes from a phone.
await assertFails(updateDoc(doc(phone, `${E}/players/in`), { checked: false }));
await assertFails(deleteDoc(doc(phone, `${E}/players/in`)));

// A new player: exactly the new-player fields.
await assertSucceeds(setDoc(doc(phone, `${E}/players/n1`), newPlayer("n1")));
await assertFails(setDoc(doc(phone, `${E}/players/n2`), newPlayer("other")));
await assertFails(setDoc(doc(phone, `${E}/players/n3`), newPlayer("n3", { games: 4 })));
await assertFails(setDoc(doc(phone, `${E}/players/n4`), newPlayer("n4", { skill: 7 })));
await assertFails(setDoc(doc(phone, `${E}/players/n5`), newPlayer("n5", { name: "" })));
await assertFails(setDoc(doc(phone, `${E}/players/n6`), newPlayer("n6", { uid: "someone" })));
await assertFails(setDoc(doc(phone, `${E}/players/n7`), newPlayer("n7", { checkedAt: 1 })));
await assertFails(setDoc(doc(phone, `${E}/players/n1`), newPlayer("n1")), "no overwriting an existing player");

// No other game data, and no costs or match log.
await assertFails(getDocs(collection(phone, `${E}/costs`)));
await assertFails(setDoc(doc(phone, `${E}/courts/c1`), { courtNumber: 1 }));

// New code: the old registration stops working; switched off or game ended: nothing.
await seed((db) => setDoc(doc(db, `${E}/private/checkin`), { on: true, code: "5555" }));
await assertFails(getDocs(collection(phone, `${E}/players`)));
await assertSucceeds(deleteDoc(doc(phone, `${E}/checkins/phone`)));
await assertSucceeds(setDoc(doc(phone, `${E}/checkins/phone`), { code: "5555", at: now() }));
await assertSucceeds(getDocs(collection(phone, `${E}/players`)));
await seed((db) => setDoc(doc(db, `${E}/private/checkin`), { on: false, code: "5555" }));
await assertFails(getDocs(collection(phone, `${E}/players`)));
await assertFails(setDoc(doc(late, `${E}/checkins/late`), { code: "5555", at: now() }));
await seed((db) => setDoc(doc(db, `${E}/private/checkin`), { on: true, code: "5555" }));
await seed((db) => updateDoc(doc(db, E), { status: "ended" }));
await assertFails(getDocs(collection(phone, `${E}/players`)));
await assertFails(setDoc(doc(late, `${E}/checkins/late`), { code: "5555", at: now() }));

console.log("checkin.test: ok");
await env.cleanup();
