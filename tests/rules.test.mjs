// Firestore rules test. Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const rules = fs.readFileSync(process.env.RULES || "firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "rules-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "sessions/club1/bookings/b1"), { title: "x", attendees: [] });
  await setDoc(doc(db, "sessions/club1/players/p1"), { name: "P" });
  await setDoc(doc(db, "accounts/u1"), { clubName: "One" });
  await setDoc(doc(db, "accounts/u1/roster/r1"), { name: "Regular" });
});

const anon = env.unauthenticatedContext().firestore();
const club1 = env.authenticatedContext("c1", { email: "club1@courtflow.local" }).firestore();
const club2 = env.authenticatedContext("c2", { email: "club2@courtflow.local" }).firestore();
const u1 = env.authenticatedContext("u1", { email: "one@example.com" }).firestore();
const u2 = env.authenticatedContext("u2", { email: "two@example.com" }).firestore();

// ---- Legacy clubs and open-play requests (sessions/**) ----
const good = { bookingId: "b1", name: "Dee", contact: "0917", method: "online", ref: "GC1", status: "pending", createdAt: Date.now() };
const cash = { ...good, method: "cash" }; delete cash.ref;
const req = (db, id) => doc(db, "sessions/club1/bookingRequests", id);

await assertSucceeds(setDoc(req(anon, "r1"), good));
await assertSucceeds(setDoc(req(anon, "r2"), cash));
await assertFails(setDoc(req(anon, "r3"), { ...good, status: "approved" }));
await assertFails(setDoc(req(anon, "r4"), { ...good, extra: 1 }));
await assertFails(setDoc(req(anon, "r5"), { ...good, bookingId: "nope" }));
await assertFails(setDoc(req(anon, "r6"), { ...good, name: "x".repeat(61) }));
await assertFails(setDoc(req(anon, "r7"), { ...good, name: "" }));
await assertFails(setDoc(req(anon, "r8"), { ...good, method: "bitcoin" }));
await assertFails(setDoc(req(anon, "r9"), { ...good, createdAt: "now" }));
await assertSucceeds(getDoc(req(anon, "r1")));
await assertFails(getDocs(collection(anon, "sessions/club1/bookingRequests")));
await assertFails(updateDoc(req(anon, "r1"), { status: "approved" }));
await assertFails(deleteDoc(req(anon, "r1")));
await assertFails(setDoc(req(anon, "r1"), good));
await assertSucceeds(getDoc(doc(anon, "sessions/club1/bookings/b1")));
await assertSucceeds(getDocs(collection(anon, "sessions/club1/players")));
await assertFails(setDoc(doc(anon, "sessions/club1/bookings/b2"), { title: "evil" }));
await assertFails(updateDoc(doc(anon, "sessions/club1/players/p1"), { name: "evil" }));
await assertSucceeds(getDocs(collection(club1, "sessions/club1/bookingRequests")));
await assertSucceeds(updateDoc(req(club1, "r1"), { status: "approved" }));
await assertSucceeds(setDoc(doc(club1, "sessions/club1/bookings/b3"), { title: "ok" }));
await assertFails(getDocs(collection(club2, "sessions/club1/bookingRequests")));
await assertFails(setDoc(doc(club2, "sessions/club1/bookings/b4"), { title: "no" }));

// ---- Accounts (accounts/{uid}/**): owner only, nothing public ----
await assertSucceeds(getDoc(doc(u1, "accounts/u1")));
await assertSucceeds(setDoc(doc(u1, "accounts/u1"), { clubName: "One", createdAt: 1 }));
await assertSucceeds(updateDoc(doc(u1, "accounts/u1"), { clubName: "One!" }));
await assertSucceeds(getDocs(collection(u1, "accounts/u1/roster")));
await assertSucceeds(setDoc(doc(u1, "accounts/u1/roster/r2"), { name: "New" }));
await assertSucceeds(setDoc(doc(u2, "accounts/u2"), { clubName: "Two" }));
await assertFails(getDoc(doc(u2, "accounts/u1")));
await assertFails(setDoc(doc(u2, "accounts/u1"), { clubName: "stolen" }));
await assertFails(getDocs(collection(u2, "accounts/u1/roster")));
await assertFails(setDoc(doc(u2, "accounts/u1/roster/r3"), { name: "evil" }));
await assertFails(getDoc(doc(anon, "accounts/u1")));
await assertFails(getDoc(doc(anon, "accounts/u1/roster/r1")));
await assertFails(setDoc(doc(anon, "accounts/u3"), { clubName: "anon" }));
// A legacy club login is not an account owner, not even of an account under its own uid.
await assertFails(getDoc(doc(club1, "accounts/u1")));
await assertFails(setDoc(doc(club1, "accounts/c1"), { clubName: "sneaky", email: "club1@courtflow.local" }));
await assertFails(getDoc(doc(club1, "accounts/c1")));
await assertFails(setDoc(doc(club1, "accounts/c1/roster/r1"), { name: "sneaky" }));

console.log("rules: all assertions passed");
await env.cleanup();
