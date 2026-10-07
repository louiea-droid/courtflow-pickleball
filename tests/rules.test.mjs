// Firestore rules test. Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const rules = fs.readFileSync(process.env.RULES || "firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "rules-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "sessions/club1/players/p1"), { name: "P" });
  await setDoc(doc(db, "accounts/u1/events/e1"), { title: "Saturday", date: "2026-10-10", attendees: [] });
  await setDoc(doc(db, "accounts/u1"), { clubName: "One" });
  await setDoc(doc(db, "accounts/u1/roster/r1"), { name: "Regular" });
});

const anon = env.unauthenticatedContext().firestore();
// Quick sessions: sessions/{id} belongs to the signed-in user whose uid is {id}
// (an anonymous visitor, or a real account). No email involved.
const club1 = env.authenticatedContext("club1").firestore();
const club2 = env.authenticatedContext("club2").firestore();
// An old club login (fake @courtflow.local email, uid c1): its email no longer grants anything.
const legacy = env.authenticatedContext("c1", { email: "club1@courtflow.local" }).firestore();
const u1 = env.authenticatedContext("u1", { email: "one@example.com" }).firestore();
const u2 = env.authenticatedContext("u2", { email: "two@example.com" }).firestore();

// ---- Quick sessions (sessions/**) ----
await assertSucceeds(getDoc(doc(anon, "sessions/club1/players/p1")));
await assertSucceeds(getDocs(collection(anon, "sessions/club1/players")));
await assertFails(updateDoc(doc(anon, "sessions/club1/players/p1"), { name: "evil" }));
await assertSucceeds(setDoc(doc(club1, "sessions/club1/bookings/b3"), { title: "ok" }));
await assertFails(setDoc(doc(club2, "sessions/club1/bookings/b4"), { title: "no" }));
// The old email rule is gone: a club login can't write a session just because its email names it.
await assertFails(setDoc(doc(legacy, "sessions/club1/bookings/b5"), { title: "old" }));
await assertFails(setDoc(doc(legacy, "sessions/club1"), { location: "old" }));
// A session is writable at its own uid by anyone signed in, whole tree, and by nobody else.
await assertSucceeds(setDoc(doc(club1, "sessions/club1"), { location: "Quick session" }));
await assertSucceeds(setDoc(doc(club1, "sessions/club1/courts/court-1"), { courtNumber: 1 }));
await assertSucceeds(setDoc(doc(u1, "sessions/u1"), { location: "Account quick session" }));
await assertSucceeds(setDoc(doc(u1, "sessions/u1/players/p1"), { name: "P" }));
await assertFails(setDoc(doc(u2, "sessions/u1/players/p2"), { name: "evil" }));
await assertFails(setDoc(doc(anon, "sessions/club1"), { location: "evil" }));
await assertSucceeds(getDoc(doc(anon, "sessions/u1")));
// Nothing creates public requests under sessions any more.
const oldReq = { bookingId: "b1", name: "Dee", contact: "0917", method: "cash", status: "pending", createdAt: Date.now() };
await assertFails(setDoc(doc(anon, "sessions/club1/bookingRequests/old1"), oldReq));

// ---- Events (accounts/{uid}/events/**): public read, owner writes, private requests ----
const ev = (db, ...rest) => doc(db, "accounts/u1/events", ...rest);
const reqCol = (db) => collection(db, "accounts/u1/events/e1/requests");
const goodReq = { name: "Dee", contact: "0917 555 0100", method: "online", ref: "GC1", seatId: "seat-1", status: "pending", createdAt: Date.now() };
const cashReq = { name: "Dee", contact: "0917", method: "cash", seatId: "seat-2", status: "pending", createdAt: Date.now() };

// Anyone can read events (the booking page), nobody but the owner writes them.
await assertSucceeds(getDoc(ev(anon, "e1")));
await assertSucceeds(getDocs(collection(anon, "accounts/u1/events")));
await assertFails(setDoc(ev(anon, "e2"), { title: "evil", attendees: [] }));
await assertFails(updateDoc(ev(anon, "e1"), { title: "evil" }));
await assertFails(deleteDoc(ev(anon, "e1")));
await assertFails(updateDoc(ev(u2, "e1"), { title: "evil" }));
await assertFails(setDoc(ev(legacy, "e2"), { title: "evil" }));
await assertSucceeds(setDoc(ev(u1, "e2"), { title: "Mine", attendees: [] }));
// The account doc and roster stay private even though events are public.
await assertFails(getDoc(doc(anon, "accounts/u1")));
await assertFails(getDocs(collection(anon, "accounts/u1/roster")));

// Join requests: a validated pending create, one read by id, never a list.
await assertSucceeds(setDoc(doc(reqCol(anon), "r1"), goodReq));
await assertSucceeds(setDoc(doc(reqCol(anon), "r2"), cashReq));
await assertFails(setDoc(doc(reqCol(anon), "r3"), { ...goodReq, status: "approved" }));
await assertFails(setDoc(doc(reqCol(anon), "r4"), { ...goodReq, extra: 1 }));
await assertFails(setDoc(doc(reqCol(anon), "r5"), { ...goodReq, name: "" }));
await assertFails(setDoc(doc(reqCol(anon), "r6"), { ...goodReq, name: "x".repeat(61) }));
await assertFails(setDoc(doc(reqCol(anon), "r7"), { ...goodReq, method: "bitcoin" }));
await assertFails(setDoc(doc(reqCol(anon), "r8"), { ...goodReq, createdAt: "now" }));
await assertFails(setDoc(doc(reqCol(anon), "r9"), { ...goodReq, bookingId: "e1" }));
// The public seat id is separate from the secret request id, so it must be present and a short string.
const { seatId: _s, ...noSeat } = goodReq;
await assertFails(setDoc(doc(reqCol(anon), "r11"), noSeat));
await assertFails(setDoc(doc(reqCol(anon), "r12"), { ...goodReq, seatId: 5 }));
await assertFails(setDoc(doc(reqCol(anon), "r13"), { ...goodReq, seatId: "x".repeat(61) }));
// Final review: a player can't pick their place in line with a made-up clock.
await assertFails(setDoc(doc(reqCol(anon), "r14"), { ...goodReq, createdAt: 0 }));
await assertFails(setDoc(doc(reqCol(anon), "r15"), { ...goodReq, createdAt: Date.now() + 86400000 }));
await assertSucceeds(setDoc(doc(reqCol(anon), "r16"), { ...goodReq, createdAt: Date.now() - 60000 }));
// Review Focus 2: an event that doesn't exist (or was deleted) can't collect requests.
await assertFails(setDoc(doc(anon, "accounts/u1/events/nope/requests/r10"), goodReq));
await assertSucceeds(getDoc(doc(reqCol(anon), "r1")));
// Review Focus 1: nobody but the owner can list requests (phone numbers).
await assertFails(getDocs(reqCol(anon)));
await assertFails(getDocs(reqCol(u2)));
await assertFails(getDocs(reqCol(legacy)));
await assertFails(updateDoc(doc(reqCol(anon), "r1"), { status: "approved" }));
await assertFails(deleteDoc(doc(reqCol(anon), "r1")));
await assertFails(setDoc(doc(reqCol(anon), "r1"), goodReq)); // overwrite = update
await assertSucceeds(getDocs(reqCol(u1)));
await assertSucceeds(updateDoc(doc(reqCol(u1), "r1"), { status: "approved" }));
await assertSucceeds(deleteDoc(doc(reqCol(u1), "r2")));

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
await assertFails(getDoc(doc(legacy, "accounts/u1")));
await assertFails(setDoc(doc(legacy, "accounts/c1"), { clubName: "sneaky", email: "club1@courtflow.local" }));
await assertFails(getDoc(doc(legacy, "accounts/c1")));
await assertFails(setDoc(doc(legacy, "accounts/c1/roster/r1"), { name: "sneaky" }));

console.log("rules: all assertions passed");
await env.cleanup();
