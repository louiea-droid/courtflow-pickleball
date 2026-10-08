// Firestore rules test. Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";

const rules = fs.readFileSync(process.env.RULES || "firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "rules-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

// ---- Seed (rules off): a public and a private club, each with an owner, a manager and a member.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "sessions/club1/players/p1"), { name: "P" });
  await setDoc(doc(db, "accounts/own"), { name: "Owner" });
  await setDoc(doc(db, "accounts/own/memberships/pub"), { clubName: "Public", role: "owner", joinedAt: 1 });
  await setDoc(doc(db, "accounts/own/events/legacy1"), { title: "Old", attendees: [] });
  for (const id of ["pub", "priv"]) {
    await setDoc(doc(db, `clubs/${id}`), { name: id, nameLower: id, visibility: id === "pub" ? "public" : "private", ownerId: "own", createdAt: 1 });
    await setDoc(doc(db, `clubs/${id}/members/own`), { role: "owner", name: "Owner", joinedAt: 1 });
    await setDoc(doc(db, `clubs/${id}/members/mgr`), { role: "manager", name: "Manager", joinedAt: 1 });
    await setDoc(doc(db, `clubs/${id}/members/mem`), { role: "member", name: "Member", joinedAt: 1 });
    await setDoc(doc(db, `clubs/${id}/events/e1`), { title: "Saturday", date: "2026-10-10", attendees: [] });
    await setDoc(doc(db, `clubs/${id}/events/e1/players/p1`), { name: "P" });
    await setDoc(doc(db, `clubs/${id}/events/e1/requests/r0`), { name: "Dee", contact: "0917", method: "cash", seatId: "s0", status: "pending", createdAt: Date.now() });
    await setDoc(doc(db, `clubs/${id}/roster/x`), { name: "Regular" });
    await setDoc(doc(db, `clubs/${id}/joinRequests/jr`), { name: "J", status: "pending" });
    await setDoc(doc(db, `clubs/${id}/private/invite`), { code: "SECRET" });
  }
});

// ---- Who is who. Real people sign in with a provider; quick sessions are anonymous; old club logins use fake emails.
const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anon = env.unauthenticatedContext().firestore();
const quick = env.authenticatedContext("q1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const legacy = env.authenticatedContext("c1", { email: "club1@courtflow.local", firebase: { sign_in_provider: "password" } }).firestore();
const club1 = env.authenticatedContext("club1").firestore();
const club2 = env.authenticatedContext("club2").firestore();
const own = real("own"), mgr = real("mgr"), mem = real("mem"), stranger = real("str");
const u1 = real("u1"), u2 = real("u2");

// ---- Quick sessions (sessions/**): unchanged
await assertSucceeds(getDoc(doc(anon, "sessions/club1/players/p1")));
await assertSucceeds(getDocs(collection(anon, "sessions/club1/players")));
await assertFails(updateDoc(doc(anon, "sessions/club1/players/p1"), { name: "evil" }));
await assertSucceeds(setDoc(doc(club1, "sessions/club1/bookings/b3"), { title: "ok" }));
await assertFails(setDoc(doc(club2, "sessions/club1/bookings/b4"), { title: "no" }));
await assertSucceeds(setDoc(doc(club1, "sessions/club1"), { location: "Quick session" }));
await assertSucceeds(setDoc(doc(u1, "sessions/u1"), { location: "Account quick session" }));
await assertSucceeds(setDoc(doc(quick, "sessions/q1"), { location: "Anonymous quick session" }));
await assertFails(setDoc(doc(u2, "sessions/u1/players/p2"), { name: "evil" }));
await assertFails(setDoc(doc(anon, "sessions/club1"), { location: "evil" }));
await assertFails(setDoc(doc(legacy, "sessions/club1"), { location: "old" }));
await assertFails(setDoc(doc(anon, "sessions/club1/bookingRequests/old1"), { name: "x" }));

// ---- Accounts (accounts/{uid}/**): the person only, and only real people
await assertSucceeds(setDoc(doc(u1, "accounts/u1"), { name: "One", createdAt: 1 }));
await assertSucceeds(updateDoc(doc(u1, "accounts/u1"), { name: "One!" }));
await assertSucceeds(setDoc(doc(u1, "accounts/u1/memberships/c9"), { clubName: "C", role: "owner", joinedAt: 1 }));
await assertSucceeds(getDocs(collection(u1, "accounts/u1/memberships")));
await assertFails(getDoc(doc(u2, "accounts/u1")));
await assertFails(getDocs(collection(u2, "accounts/u1/memberships")));
await assertFails(setDoc(doc(u2, "accounts/u1/memberships/c9"), { clubName: "evil", role: "owner", joinedAt: 1 }));
await assertFails(getDoc(doc(anon, "accounts/u1")));
// Review Focus 4: a quick-session (anonymous) user and an old club login are not people with accounts.
await assertFails(setDoc(doc(quick, "accounts/q1"), { name: "anon" }));
await assertFails(setDoc(doc(legacy, "accounts/c1"), { name: "sneaky" }));
await assertFails(getDoc(doc(legacy, "accounts/c1")));
// Events from before clubs, left under an account, are not public any more.
await assertFails(getDoc(doc(anon, "accounts/own/events/legacy1")));
await assertSucceeds(getDoc(doc(own, "accounts/own/events/legacy1")));

// ---- Clubs: create
const newClub = (ownerId, extra = {}) => ({ name: "Fresh", nameLower: "fresh", visibility: "public", ownerId, createdAt: 1, ...extra });
await assertSucceeds(setDoc(doc(u1, "clubs/mine"), newClub("u1")));
await assertSucceeds(setDoc(doc(u1, "clubs/mine2"), newClub("u1", { visibility: "private", description: "d", location: "Manila" })));
await assertFails(setDoc(doc(u1, "clubs/x1"), newClub("u2"))); // can't make a club for someone else
await assertFails(setDoc(doc(anon, "clubs/x2"), newClub("u1")));
await assertFails(setDoc(doc(quick, "clubs/x3"), newClub("q1"))); // Review Focus 4
await assertFails(setDoc(doc(legacy, "clubs/x4"), newClub("c1")));
await assertFails(setDoc(doc(u1, "clubs/x5"), newClub("u1", { name: "" })));
await assertFails(setDoc(doc(u1, "clubs/x6"), newClub("u1", { name: "x".repeat(61) })));
await assertFails(setDoc(doc(u1, "clubs/x7"), newClub("u1", { visibility: "secret" })));
await assertFails(setDoc(doc(u1, "clubs/x8"), newClub("u1", { description: "x".repeat(501) })));

// The owner's member record is created in the same batch as the club, and only then.
{
  const b = writeBatch(u2);
  b.set(doc(u2, "clubs/batch1"), newClub("u2"));
  b.set(doc(u2, "clubs/batch1/members/u2"), { role: "owner", name: "Two", joinedAt: 1 });
  b.set(doc(u2, "accounts/u2/memberships/batch1"), { clubName: "Fresh", role: "owner", joinedAt: 1 });
  await assertSucceeds(b.commit());
}
await assertFails(setDoc(doc(u2, "clubs/mine/members/u2"), { role: "owner", name: "Two", joinedAt: 1 })); // someone else's club
await assertFails(setDoc(doc(u2, "clubs/mine/members/u2"), { role: "member", name: "Two", joinedAt: 1 })); // no self-join in part A
await assertFails(setDoc(doc(u2, "clubs/mine/members/u1"), { role: "owner", name: "Two", joinedAt: 1 })); // another person's record

// ---- Clubs: read
await assertSucceeds(getDoc(doc(anon, "clubs/pub"))); // public: anyone, no sign-in
await assertFails(getDoc(doc(anon, "clubs/priv")));
await assertFails(getDoc(doc(quick, "clubs/priv")));
await assertSucceeds(getDoc(doc(stranger, "clubs/priv"))); // private: any signed-in person who has the address
await assertSucceeds(getDocs(query(collection(anon, "clubs"), where("visibility", "==", "public")))); // the directory
await assertFails(getDocs(collection(anon, "clubs"))); // no listing everything
await assertFails(getDocs(collection(stranger, "clubs")));
await assertFails(getDocs(query(collection(stranger, "clubs"), where("visibility", "==", "private")))); // private clubs are never listed

// ---- Clubs: update and delete
await assertSucceeds(updateDoc(doc(own, "clubs/pub"), { description: "Hello" }));
await assertSucceeds(updateDoc(doc(own, "clubs/pub"), { visibility: "private" }));
await assertSucceeds(updateDoc(doc(own, "clubs/pub"), { visibility: "public" }));
await assertSucceeds(updateDoc(doc(mgr, "clubs/pub"), { name: "Renamed", nameLower: "renamed" }));
await assertFails(updateDoc(doc(mgr, "clubs/pub"), { visibility: "private" })); // owner only
await assertFails(updateDoc(doc(mgr, "clubs/pub"), { ownerId: "mgr" }));
await assertFails(updateDoc(doc(own, "clubs/pub"), { ownerId: "mgr" }));
await assertFails(updateDoc(doc(mem, "clubs/pub"), { name: "no" }));
await assertFails(updateDoc(doc(stranger, "clubs/pub"), { name: "no" }));
await assertFails(updateDoc(doc(anon, "clubs/pub"), { name: "no" }));
await assertFails(updateDoc(doc(own, "clubs/pub"), { name: "" }));
await assertFails(deleteDoc(doc(mgr, "clubs/pub")));
await assertFails(deleteDoc(doc(mem, "clubs/pub")));
await assertFails(deleteDoc(doc(stranger, "clubs/pub")));

// ---- Members
await assertSucceeds(getDoc(doc(stranger, "clubs/pub/members/str"))); // your own record, even when there is none
await assertFails(getDoc(doc(stranger, "clubs/pub/members/mem"))); // someone else's record
await assertSucceeds(getDocs(collection(mem, "clubs/pub/members")));
await assertSucceeds(getDocs(collection(own, "clubs/priv/members")));
await assertFails(getDocs(collection(stranger, "clubs/pub/members")));
await assertFails(getDocs(collection(anon, "clubs/pub/members")));
await assertFails(updateDoc(doc(own, "clubs/pub/members/mem"), { role: "owner" })); // nobody becomes owner (naming managers is in membership.test.mjs)
await assertFails(deleteDoc(doc(mem, "clubs/pub/members/mgr"))); // a member can't remove a manager (managers removing plain members is in membership.test.mjs)
await assertFails(deleteDoc(doc(own, "clubs/pub/members/own"))); // the owner can't leave a club that still exists
await assertSucceeds(deleteDoc(doc(own, "clubs/priv/members/mem")));
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "clubs/priv/members/mem"), { role: "member", name: "Member", joinedAt: 1 }));

// ---- Events: read
await assertSucceeds(getDoc(doc(anon, "clubs/pub/events/e1"))); // public club: anyone
await assertSucceeds(getDocs(collection(anon, "clubs/pub/events")));
await assertFails(getDoc(doc(anon, "clubs/priv/events/e1"))); // Review Focus 1: private club
await assertFails(getDoc(doc(stranger, "clubs/priv/events/e1")));
await assertFails(getDoc(doc(quick, "clubs/priv/events/e1")));
await assertFails(getDocs(collection(stranger, "clubs/priv/events")));
await assertSucceeds(getDoc(doc(mem, "clubs/priv/events/e1")));
await assertSucceeds(getDocs(collection(mgr, "clubs/priv/events")));
// ---- Events: write (managers only)
await assertSucceeds(setDoc(doc(own, "clubs/pub/events/e2"), { title: "Mine", attendees: [] }));
await assertSucceeds(updateDoc(doc(mgr, "clubs/pub/events/e1"), { title: "Edited" }));
await assertFails(setDoc(doc(mem, "clubs/pub/events/e3"), { title: "no" }));
await assertFails(setDoc(doc(stranger, "clubs/pub/events/e3"), { title: "no" }));
await assertFails(setDoc(doc(anon, "clubs/pub/events/e3"), { title: "no" }));
await assertFails(updateDoc(doc(anon, "clubs/pub/events/e1"), { title: "evil" }));
await assertFails(deleteDoc(doc(mem, "clubs/pub/events/e1")));

// ---- Game data under an event: managers only (names stay private until the Live Board decides what to show)
const g = (db, club, path) => doc(db, `clubs/${club}/events/e1`, path);
await assertSucceeds(setDoc(g(own, "pub", "players/p2"), { name: "P", checked: false }));
await assertSucceeds(setDoc(g(mgr, "pub", "courts/court-1"), { courtNumber: 1 }));
await assertSucceeds(setDoc(g(mgr, "pub", "matchLog/m1"), { court: "Court 1" }));
await assertSucceeds(setDoc(g(mgr, "pub", "costs/booking-e1"), { label: "Saturday" }));
await assertSucceeds(getDocs(collection(mgr, "clubs/pub/events/e1/players")));
await assertFails(getDoc(g(anon, "pub", "players/p1")));
await assertFails(getDoc(g(stranger, "pub", "players/p1")));
await assertFails(getDoc(g(mem, "pub", "players/p1")));
await assertFails(getDocs(collection(mem, "clubs/pub/events/e1/courts")));
await assertFails(setDoc(g(mem, "pub", "players/p3"), { name: "evil" }));
await assertFails(setDoc(g(anon, "pub", "players/p3"), { name: "evil" }));
await assertFails(deleteDoc(g(stranger, "pub", "courts/court-1")));

// ---- Join requests for an event (a player's request): a validated pending create, one read by id, never a list
const req = (clubId) => (db) => collection(db, `clubs/${clubId}/events/e1/requests`);
const pubReq = req("pub"), privReq = req("priv");
const goodReq = { name: "Dee", contact: "0917 555 0100", method: "online", ref: "GC1", seatId: "seat-1", status: "pending", createdAt: Date.now() };
const cashReq = { name: "Dee", contact: "0917", method: "cash", seatId: "seat-2", status: "pending", createdAt: Date.now() };
await assertSucceeds(setDoc(doc(pubReq(anon), "r1"), goodReq)); // public club, nobody signed in
await assertSucceeds(setDoc(doc(pubReq(anon), "r2"), cashReq));
await assertSucceeds(setDoc(doc(pubReq(stranger), "r16"), { ...goodReq, createdAt: Date.now() - 60000 }));
await assertFails(setDoc(doc(pubReq(anon), "r3"), { ...goodReq, status: "approved" }));
await assertFails(setDoc(doc(pubReq(anon), "r4"), { ...goodReq, extra: 1 }));
await assertFails(setDoc(doc(pubReq(anon), "r5"), { ...goodReq, name: "" }));
await assertFails(setDoc(doc(pubReq(anon), "r6"), { ...goodReq, name: "x".repeat(61) }));
await assertFails(setDoc(doc(pubReq(anon), "r7"), { ...goodReq, method: "bitcoin" }));
await assertFails(setDoc(doc(pubReq(anon), "r8"), { ...goodReq, createdAt: "now" }));
await assertFails(setDoc(doc(pubReq(anon), "r9"), { ...goodReq, bookingId: "e1" }));
const { seatId: _s, ...noSeat } = goodReq;
await assertFails(setDoc(doc(pubReq(anon), "r11"), noSeat));
await assertFails(setDoc(doc(pubReq(anon), "r12"), { ...goodReq, seatId: 5 }));
await assertFails(setDoc(doc(pubReq(anon), "r13"), { ...goodReq, seatId: "x".repeat(61) }));
await assertFails(setDoc(doc(pubReq(anon), "r14"), { ...goodReq, createdAt: 0 })); // can't pick your place in line
await assertFails(setDoc(doc(pubReq(anon), "r15"), { ...goodReq, createdAt: Date.now() + 86400000 }));
await assertFails(setDoc(doc(anon, "clubs/pub/events/nope/requests/r10"), goodReq)); // event must exist
await assertFails(setDoc(doc(anon, "clubs/nope/events/e1/requests/r10"), goodReq)); // club must exist
// Review Focus 1: a private club's booking is for its members.
await assertFails(setDoc(doc(privReq(anon), "p1"), goodReq));
await assertFails(setDoc(doc(privReq(stranger), "p2"), goodReq));
await assertSucceeds(setDoc(doc(privReq(mem), "p3"), goodReq));
// Reading and managing requests.
await assertSucceeds(getDoc(doc(pubReq(anon), "r1")));
await assertFails(getDoc(doc(privReq(anon), "r0")));
await assertSucceeds(getDoc(doc(privReq(mem), "p3")));
await assertFails(getDocs(pubReq(anon))); // phone numbers: no public list
await assertFails(getDocs(pubReq(stranger)));
await assertFails(getDocs(pubReq(mem)));
await assertSucceeds(getDocs(pubReq(mgr)));
await assertSucceeds(getDocs(privReq(own)));
await assertFails(updateDoc(doc(pubReq(anon), "r1"), { status: "approved" }));
await assertFails(deleteDoc(doc(pubReq(anon), "r1")));
await assertFails(setDoc(doc(pubReq(anon), "r1"), goodReq)); // overwrite = update
await assertSucceeds(updateDoc(doc(pubReq(mgr), "r1"), { status: "approved" }));
await assertSucceeds(deleteDoc(doc(pubReq(own), "r2")));
await assertFails(updateDoc(doc(pubReq(mem), "r16"), { status: "approved" }));

// ---- Roster, join requests and the invite document
await assertSucceeds(getDocs(collection(mem, "clubs/pub/roster")));
await assertFails(getDocs(collection(stranger, "clubs/pub/roster")));
await assertFails(getDocs(collection(anon, "clubs/pub/roster")));
await assertSucceeds(setDoc(doc(mgr, "clubs/pub/roster/y"), { name: "New" }));
await assertFails(setDoc(doc(mem, "clubs/pub/roster/z"), { name: "evil" }));
await assertSucceeds(getDocs(collection(mgr, "clubs/pub/joinRequests")));
await assertFails(getDocs(collection(mem, "clubs/pub/joinRequests")));
await assertFails(getDocs(collection(stranger, "clubs/pub/joinRequests")));
await assertSucceeds(getDoc(doc(mgr, "clubs/pub/private/invite")));
await assertFails(getDoc(doc(mem, "clubs/pub/private/invite"))); // the invite code never leaks to members or the public
await assertFails(getDoc(doc(anon, "clubs/pub/private/invite")));
await assertFails(getDoc(doc(stranger, "clubs/priv/private/invite")));

// ---- Deleting a club (the order the app uses): the club doc first (needs the owner record), then the owner's own record
await assertFails(deleteDoc(doc(u1, "clubs/mine2"))); // u1 made it with no owner record in this test, so is no manager
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "clubs/mine/members/u1"), { role: "owner", name: "One", joinedAt: 1 }));
await assertSucceeds(deleteDoc(doc(u1, "clubs/mine")));
await assertSucceeds(deleteDoc(doc(u1, "clubs/mine/members/u1"))); // allowed once the club is gone
await assertSucceeds(deleteDoc(doc(u2, "clubs/batch1"))); // the club made in the batch above
await assertSucceeds(deleteDoc(doc(u2, "clubs/batch1/members/u2")));

console.log("rules: all assertions passed");
await env.cleanup();
