// Firestore rules for joining: requests, invite joins, approval, leaving, removing.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const rules = fs.readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "membership-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anon = env.unauthenticatedContext().firestore();
const quick = env.authenticatedContext("q1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const legacy = env.authenticatedContext("c1", { email: "club1@courtflow.local", firebase: { sign_in_provider: "password" } }).firestore();
const own = real("own"), mgr = real("mgr"), mem = real("mem"), mem2 = real("mem2"), req = real("req"), req2 = real("req2"), other = real("other");
const now = () => Date.now();

// A public club "pub" and a private club "priv": an owner, two managers, two members, an invite code and the
// members' "My clubs" copies. "noinv" is a public club that never created an invite link.
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const id of ["pub", "priv"]) {
      await setDoc(doc(db, `clubs/${id}`), { name: id, nameLower: id, visibility: id === "pub" ? "public" : "private", ownerId: "own", createdAt: 1 });
      const people = { own: "owner", mgr: "manager", mgr2: "manager", mem: "member", mem2: "member" };
      for (const [uid, role] of Object.entries(people)) {
        await setDoc(doc(db, `clubs/${id}/members/${uid}`), { role, name: uid, joinedAt: 1 });
        await setDoc(doc(db, `accounts/${uid}/memberships/${id}`), { clubName: id, role, joinedAt: 1 });
      }
      await setDoc(doc(db, `clubs/${id}/private/invite`), { code: "GOODCODE" });
      await setDoc(doc(db, `clubs/${id}/private/managerInvite`), { code: "MGRCODE1" });
    }
    await setDoc(doc(db, "clubs/noinv"), { name: "noinv", nameLower: "noinv", visibility: "public", ownerId: "own", createdAt: 1 });
    await setDoc(doc(db, "clubs/noinv/members/own"), { role: "owner", name: "own", joinedAt: 1 });
  });
}
const putRequest = (club, uid, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `clubs/${club}/joinRequests/${uid}`), data));
const jr = (db, club, uid) => doc(db, `clubs/${club}/joinRequests/${uid}`);
const reqDoc = (extra = {}) => ({ name: "Rae", status: "pending", createdAt: now(), ...extra });
const copyDoc = (club) => ({ clubName: club, role: "member", joinedAt: now() });

// ---- Join requests
await seed();
await assertSucceeds(setDoc(jr(req, "pub", "req"), reqDoc({ message: "Hi, I play Saturdays" })));
await assertFails(setDoc(jr(req, "pub", "req"), reqDoc())); // a second request is an update
await assertFails(setDoc(jr(req2, "priv", "req2"), reqDoc())); // private clubs take no requests
await assertFails(setDoc(jr(req2, "pub", "req"), reqDoc())); // someone else's id
await assertFails(setDoc(jr(anon, "pub", "req2"), reqDoc()));
await assertFails(setDoc(jr(quick, "pub", "q1"), reqDoc())); // Review Focus 1: anonymous quick-session user
await assertFails(setDoc(jr(legacy, "pub", "c1"), reqDoc())); // old club login
await assertFails(setDoc(jr(mem, "pub", "mem"), reqDoc())); // already a member
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ extra: 1 })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ status: "approved" })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ name: "" })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ name: "x".repeat(61) })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ message: "x".repeat(201) })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ createdAt: 0 })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ createdAt: now() + 86400000 })));
await assertFails(setDoc(jr(req2, "nope", "req2"), reqDoc())); // no such club
// reads
await assertSucceeds(getDoc(jr(req, "pub", "req")));
await assertSucceeds(getDoc(jr(req2, "pub", "req2"))); // your own, even when there is none
await assertFails(getDoc(jr(other, "pub", "req")));
await assertFails(getDoc(jr(mem, "pub", "req")));
await assertFails(getDoc(jr(anon, "pub", "req")));
await assertSucceeds(getDoc(jr(mgr, "pub", "req")));
await assertSucceeds(getDoc(jr(own, "pub", "req")));
await assertSucceeds(getDocs(collection(mgr, "clubs/pub/joinRequests")));
await assertFails(getDocs(collection(mem, "clubs/pub/joinRequests")));
await assertFails(getDocs(collection(req, "clubs/pub/joinRequests")));
// updates: only a manager, only to declined
await assertFails(updateDoc(jr(mgr, "pub", "req"), { status: "approved" }));
await assertFails(updateDoc(jr(mgr, "pub", "req"), { name: "Other" }));
await assertFails(updateDoc(jr(mgr, "pub", "req"), { status: "declined", name: "Other" }));
await assertFails(updateDoc(jr(req, "pub", "req"), { status: "declined" }));
await assertFails(updateDoc(jr(mem, "pub", "req"), { status: "declined" }));
await assertSucceeds(updateDoc(jr(own, "pub", "req"), { status: "declined" }));
// deletes: the requester (withdraw, dismiss) or a manager
await assertFails(deleteDoc(jr(other, "pub", "req")));
await assertFails(deleteDoc(jr(mem, "pub", "req")));
await assertSucceeds(deleteDoc(jr(req, "pub", "req")));
await putRequest("pub", "req", reqDoc());
await assertSucceeds(deleteDoc(jr(mgr, "pub", "req")));

// ---- Joining with the invite link: the member record carries the code, plus the person's own card
await seed();
const memberDoc = (extra = {}) => ({ role: "member", name: "Rae", joinedAt: now(), inviteCode: "GOODCODE", ...extra });
const join = (db, club, uid, data, copy = copyDoc(club)) => {
  const b = writeBatch(db);
  b.set(doc(db, `clubs/${club}/members/${uid}`), data);
  b.set(doc(db, `accounts/${uid}/memberships/${club}`), copy);
  return b.commit();
};
const { inviteCode: _code, ...noCode } = memberDoc();
await assertFails(join(other, "pub", "other", memberDoc({ inviteCode: "OLDCODE" }))); // Review Focus 3: wrong code
await assertFails(join(other, "pub", "other", noCode));
await assertFails(join(other, "pub", "other", memberDoc({ role: "manager" }))); // Review Focus 1: higher role
await assertFails(join(other, "pub", "other", memberDoc({ role: "owner" })));
await assertFails(join(other, "pub", "other", memberDoc({ extra: 1 })));
await assertFails(join(other, "pub", "other", memberDoc({ name: "" })));
await assertFails(join(other, "pub", "other", memberDoc({ joinedAt: 0 })));
await assertFails(join(other, "pub", "req", memberDoc())); // someone else's record
await assertFails(join(anon, "pub", "x", memberDoc()));
await assertFails(join(quick, "pub", "q1", memberDoc()));
await assertFails(join(legacy, "pub", "c1", memberDoc()));
await assertFails(join(mem, "pub", "mem", memberDoc())); // already a member: re-creating is an update
await assertFails(join(other, "noinv", "other", memberDoc())); // a club that never made an invite link
await assertSucceeds(join(req, "pub", "req", memberDoc()));
await assertSucceeds(join(req2, "priv", "req2", memberDoc())); // private clubs are joined this way
await assertSucceeds(getDoc(doc(req, "clubs/pub/members/mem"))); // now a member: can read the list
await assertFails(getDoc(doc(req, "clubs/pub/private/invite"))); // but the invite document stays managers-only
await assertFails(getDoc(doc(other, "clubs/pub/private/invite")));
await assertFails(getDoc(doc(mem, "clubs/pub/private/invite")));
// reset: a manager replaces the code; the old one stops working at once
await assertSucceeds(setDoc(doc(mgr, "clubs/pub/private/invite"), { code: "NEWCODE2" }));
await assertFails(setDoc(doc(mem, "clubs/pub/private/invite"), { code: "MEMCODE1" }));
await assertFails(setDoc(doc(mgr, "clubs/pub/private/invite"), { code: "short" })); // a code is 8 characters
await assertFails(setDoc(doc(mgr, "clubs/pub/private/invite"), { code: 12345678 }));
await assertFails(setDoc(doc(mgr, "clubs/pub/private/invite"), { code: "ABCDEFGH", extra: 1 }));
await assertFails(join(other, "pub", "other", memberDoc())); // GOODCODE is old now
await assertSucceeds(join(other, "pub", "other", memberDoc({ inviteCode: "NEWCODE2" })));

// ---- Approval: member record + the person's card + the request, in one batch, by a manager
await seed();
await putRequest("pub", "req", reqDoc());
const approvedMember = (extra = {}) => ({ role: "member", name: "Rae", joinedAt: now(), ...extra });
const approve = (db, club, uid, member = approvedMember(), copy = copyDoc(club)) => {
  const b = writeBatch(db);
  b.set(doc(db, `clubs/${club}/members/${uid}`), member);
  b.set(doc(db, `accounts/${uid}/memberships/${club}`), copy);
  b.delete(jr(db, club, uid));
  return b.commit();
};
await assertFails(approve(mem, "pub", "req")); // a plain member
await assertFails(approve(other, "pub", "req")); // a stranger
await assertFails(approve(mgr, "pub", "req", approvedMember({ role: "manager" })));
await assertFails(approve(mgr, "pub", "req", approvedMember({ role: "owner" })));
await assertFails(approve(mgr, "pub", "req", approvedMember({ inviteCode: "GOODCODE" }))); // approval never carries a code
await assertFails(approve(mgr, "pub", "req", approvedMember(), { clubName: "pub", role: "owner", joinedAt: 1 })); // card claiming owner
await assertFails(approve(mgr, "pub", "nobody")); // no request from that person
await putRequest("pub", "req2", reqDoc({ status: "declined" }));
await assertFails(approve(mgr, "pub", "req2")); // a declined request is not approvable
await assertFails(setDoc(doc(mgr, "accounts/req/memberships/pub"), copyDoc("pub"))); // a card with no member record
await assertFails(setDoc(doc(mgr, "accounts/req"), { name: "x" })); // nothing else of theirs
await assertFails(approve(mgr, "pub", "req", approvedMember(), { clubName: "x".repeat(61), role: "member", joinedAt: now() })); // card name too long
await assertFails(approve(mgr, "pub", "req", approvedMember(), { clubName: "pub", role: "member", joinedAt: "yesterday" }));
await assertFails(setDoc(doc(mgr, "accounts/mem/memberships/pub"), copyDoc("pub"))); // a card for someone who is already a member
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "accounts/req/memberships/pub"), { clubName: "old", role: "member", joinedAt: 1 }));
await assertSucceeds(approve(mgr, "pub", "req")); // a stale card from an earlier stay is replaced
await seed();
await putRequest("pub", "req", reqDoc());
await assertSucceeds(approve(mgr, "pub", "req"));
await putRequest("pub", "other", reqDoc());
await assertSucceeds(approve(own, "pub", "other"));

// ---- Leaving and removing
await seed();
const drop = (db, club, uid) => {
  const b = writeBatch(db);
  b.delete(doc(db, `clubs/${club}/members/${uid}`));
  b.delete(doc(db, `accounts/${uid}/memberships/${club}`));
  return b.commit();
};
await assertFails(drop(mem, "pub", "mem2")); // a member removing a member
await assertFails(drop(mem, "pub", "mgr"));
await assertFails(drop(mgr, "pub", "own")); // a manager removing the owner
await assertFails(drop(mgr, "pub", "mgr2")); // a manager removing another manager
await assertFails(drop(own, "pub", "own")); // the owner can't leave a club that still exists
await assertFails(deleteDoc(doc(mgr, "accounts/mem2/memberships/pub"))); // a card alone, while still a member
await assertFails(deleteDoc(doc(mem2, "accounts/mem/memberships/pub")));
await assertFails(deleteDoc(doc(mgr, "accounts/own/memberships/pub"))); // never the owner's card
await assertSucceeds(drop(mgr, "pub", "mem")); // a manager removes a plain member and the card
await assertSucceeds(drop(mem2, "pub", "mem2")); // a member leaves
await assertSucceeds(drop(own, "pub", "mgr2")); // the owner removes a manager
await assertSucceeds(drop(mgr, "priv", "mem")); // the same on a private club
await assertFails(getDoc(doc(real("mem"), "clubs/priv/events/e1"))); // a removed member is a stranger again

// ---- Part C: only the owner changes roles; a manager link (the owner's) joins as a manager
await seed();
const setRole = (db, club, uid, role, cardRole = role, extra = {}) => {
  const b = writeBatch(db);
  b.update(doc(db, `clubs/${club}/members/${uid}`), { role, ...extra });
  b.update(doc(db, `accounts/${uid}/memberships/${club}`), { role: cardRole });
  return b.commit();
};
await assertFails(setRole(mgr, "pub", "mem", "manager")); // a manager can't name managers
await assertFails(setRole(mem, "pub", "mem2", "manager"));
await assertFails(setRole(mem, "pub", "mem", "manager")); // nor can you promote yourself
await assertFails(setRole(mgr, "pub", "mgr", "owner"));
await assertFails(setRole(other, "pub", "mem", "manager"));
await assertFails(setRole(mgr, "pub", "mgr2", "member")); // a manager can't demote a manager
await assertFails(setRole(own, "pub", "mem", "owner")); // nobody becomes owner
await assertFails(setRole(own, "pub", "mem", "admin"));
await assertFails(setRole(own, "pub", "own", "member")); // the owner never changes
await assertFails(setRole(own, "pub", "mem", "manager", "member")); // the card must say the same
await assertFails(setRole(own, "pub", "mem", "manager", "owner"));
await assertFails(setRole(own, "pub", "mem", "manager", "manager", { name: "Renamed" })); // only the role changes
await assertFails(updateDoc(doc(own, "accounts/mem/memberships/pub"), { role: "manager" })); // a card alone
await assertSucceeds(setRole(own, "pub", "mem", "manager"));
await assertSucceeds(getDoc(doc(mem, "clubs/pub/private/invite"))); // the new manager can manage
await assertSucceeds(setRole(own, "pub", "mgr", "member")); // and the owner can demote
await assertFails(getDoc(doc(mgr, "clubs/pub/private/invite")));
await assertSucceeds(setRole(own, "priv", "mem2", "manager")); // the same on a private club
// the manager link: its own document, only the owner reads or writes it
await assertFails(getDoc(doc(mgr, "clubs/priv/private/managerInvite")));
await assertFails(setDoc(doc(mgr, "clubs/priv/private/managerInvite"), { code: "ABCDEFGH" }));
await assertFails(setDoc(doc(mem, "clubs/priv/private/managerInvite"), { code: "ABCDEFGH" }));
await assertSucceeds(getDoc(doc(own, "clubs/priv/private/managerInvite")));
await assertFails(setDoc(doc(own, "clubs/priv/private/managerInvite"), { code: "short" }));
const managerDoc = (extra = {}) => memberDoc({ role: "manager", inviteCode: "MGRCODE1", ...extra });
const managerCard = (club) => ({ clubName: club, role: "manager", joinedAt: now() });
await assertFails(join(other, "pub", "other", managerDoc({ inviteCode: "GOODCODE" }), managerCard("pub"))); // the member code doesn't make managers
await assertFails(join(other, "pub", "other", memberDoc({ inviteCode: "MGRCODE1" }))); // and the manager code doesn't make members
await assertFails(join(other, "pub", "other", managerDoc({ inviteCode: "WRONGONE" }), managerCard("pub")));
await assertFails(join(other, "noinv", "other", managerDoc(), managerCard("noinv"))); // no manager link was ever made
await assertFails(join(other, "pub", "other", managerDoc({ role: "owner" }), managerCard("pub")));
await assertFails(join(anon, "pub", "x", managerDoc(), managerCard("pub")));
await assertFails(join(quick, "pub", "q1", managerDoc(), managerCard("pub")));
await assertSucceeds(join(other, "pub", "other", managerDoc(), managerCard("pub")));
await assertSucceeds(getDoc(doc(other, "clubs/pub/private/invite"))); // a manager now
await assertSucceeds(setDoc(doc(own, "clubs/pub/private/managerInvite"), { code: "RESETTED" })); // reset: the old manager link stops
await assertFails(join(req, "pub", "req", managerDoc(), managerCard("pub")));
await assertSucceeds(join(req, "pub", "req", managerDoc({ inviteCode: "RESETTED" }), managerCard("pub")));

console.log("membership: all assertions passed");
await env.cleanup();
