// Delete cascades for events, clubs and accounts. Run: npm run test:rules (needs Java and the Firebase CLI).
import assert from "node:assert";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { deleteAccountData, deleteClubData, deleteEventData, leaveClub } from "../src/utils/accountData.js";

const env = await initializeTestEnvironment({
  projectId: "cascade-test",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});
const count = async (path) => {
  let n;
  await env.withSecurityRulesDisabled(async (ctx) => { n = (await getDocs(collection(ctx.firestore(), path))).size; });
  return n;
};
const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const EVENT_SUBS = ["requests", "players", "courts", "matchLog", "costs"];

// A club with two events (every subcollection), a roster, a join request, an invite, an owner and a member.
const seedClub = async (db, id, ownerId) => {
  await setDoc(doc(db, `clubs/${id}`), { name: id, visibility: "public", ownerId, createdAt: 1 });
  await setDoc(doc(db, `clubs/${id}/members/${ownerId}`), { role: "owner", name: ownerId, joinedAt: 1 });
  await setDoc(doc(db, `clubs/${id}/members/helper`), { role: "member", name: "Helper", joinedAt: 1 });
  await setDoc(doc(db, `accounts/helper/memberships/${id}`), { clubName: id, role: "member", joinedAt: 1 });
  await setDoc(doc(db, `clubs/${id}/roster/r1`), { name: "Regular" });
  await setDoc(doc(db, `clubs/${id}/joinRequests/j1`), { name: "J" });
  await setDoc(doc(db, `clubs/${id}/private/invite`), { code: "X" });
  await setDoc(doc(db, `clubs/${id}/private/managerInvite`), { code: "Y" });
  for (const e of ["e1", "e2"]) {
    await setDoc(doc(db, `clubs/${id}/events/${e}`), { title: e, attendees: [] });
    for (const sub of EVENT_SUBS) await setDoc(doc(db, `clubs/${id}/events/${e}/${sub}/x`), { n: 1 });
  }
};

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await seedClub(db, "c1", "u1");
  await seedClub(db, "c2", "u2"); // must never be touched
  await seedClub(db, "c3", "u3");
  await setDoc(doc(db, "accounts/u1"), { name: "One" });
  await setDoc(doc(db, "accounts/u1/memberships/c1"), { clubName: "c1", role: "owner", joinedAt: 1 });
  await setDoc(doc(db, "accounts/u1/memberships/c2"), { clubName: "c2", role: "member", joinedAt: 1 }); // belongs, doesn't own
  // Old data from before clubs, still under the account.
  await setDoc(doc(db, "accounts/u1/roster/old"), { name: "Old" });
  await setDoc(doc(db, "accounts/u1/events/oldEvent"), { title: "Old" });
  for (const sub of EVENT_SUBS) await setDoc(doc(db, `accounts/u1/events/oldEvent/${sub}/x`), { n: 1 });
  await setDoc(doc(db, "accounts/u2"), { name: "Two" });
});

// Deleting one event takes the doc and every subcollection, and leaves the other event alone.
await deleteEventData(real("u3"), "c3", "e1");
assert.equal(await count("clubs/c3/events"), 1);
for (const sub of EVENT_SUBS) {
  assert.equal(await count(`clubs/c3/events/e1/${sub}`), 0, `c3/e1/${sub} left behind`);
  assert.equal(await count(`clubs/c3/events/e2/${sub}`), 1, `c3/e2/${sub} was touched`);
}

// Review Focus 2: deleting a club, run as its owner, leaves nothing.
await deleteClubData(real("u3"), "c3", "u3");
assert.equal(await count("accounts/helper/memberships"), 2, "helper's c3 card left behind"); // c1 and c2 remain
for (const sub of ["events", "members", "roster", "joinRequests", "private"]) {
  assert.equal(await count(`clubs/c3/${sub}`), 0, `c3/${sub} left behind`);
}
for (const e of ["e1", "e2"]) {
  for (const sub of EVENT_SUBS) assert.equal(await count(`clubs/c3/events/${e}/${sub}`), 0, `c3/${e}/${sub} left behind`);
}
await env.withSecurityRulesDisabled(async (ctx) => {
  const clubs = await getDocs(collection(ctx.firestore(), "clubs"));
  assert.equal(clubs.docs.map((d) => d.id).sort().join(), "c1,c2"); // c3 is gone
});

// Deleting an account removes the clubs it owns, its copies, and the pre-club data; clubs it only belongs to stay.
await deleteAccountData(real("u1"), "u1");
for (const sub of ["events", "members", "roster", "joinRequests", "private"]) {
  assert.equal(await count(`clubs/c1/${sub}`), 0, `c1/${sub} left behind`);
}
for (const e of ["e1", "e2"]) {
  for (const sub of EVENT_SUBS) assert.equal(await count(`clubs/c1/events/${e}/${sub}`), 0, `c1/${e}/${sub} left behind`);
}
assert.equal(await count("accounts/u1/memberships"), 0);
assert.equal(await count("accounts/u1/roster"), 0);
assert.equal(await count("accounts/u1/events"), 0);
assert.equal(await count("accounts/helper/memberships"), 1, "helper's c1 card left behind"); // only c2 remains
for (const sub of EVENT_SUBS) assert.equal(await count(`accounts/u1/events/oldEvent/${sub}`), 0, `legacy ${sub} left behind`);
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  assert.equal((await getDocs(collection(db, "accounts"))).docs.map((d) => d.id).join(), "u2");
  assert.equal((await getDocs(collection(db, "clubs"))).docs.map((d) => d.id).join(), "c2");
});
assert.equal(await count("clubs/c2/members"), 2);
assert.equal(await count("clubs/c2/events/e1/players"), 1);

// An interrupted club delete (tab closed midway) must not trap the owner. Two leftovers:
// (a) club and owner record gone but the "My clubs" copy remains; (b) club gone, owner record and copy remain.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "accounts/u4"), { name: "Four" });
  await setDoc(doc(db, "accounts/u4/memberships/c4"), { clubName: "c4", role: "owner", joinedAt: 1 });
  await setDoc(doc(db, "accounts/u5"), { name: "Five" });
  await setDoc(doc(db, "accounts/u5/memberships/c5"), { clubName: "c5", role: "owner", joinedAt: 1 });
  await setDoc(doc(db, "clubs/c5/members/u5"), { role: "owner", name: "Five", joinedAt: 1 });
});
await deleteClubData(real("u5"), "c5", "u5");
assert.equal(await count("clubs/c5/members"), 0, "c5 owner record left behind");
assert.equal(await count("accounts/u5/memberships"), 0, "c5 copy left behind");
await deleteAccountData(real("u4"), "u4"); // used to throw permission-denied
assert.equal(await count("accounts/u4/memberships"), 0, "c4 copy left behind");

// An interrupted club delete (tab closed midway) must not trap the owner. Two leftovers:
// (a) club and owner record gone but the "My clubs" copy remains; (b) club gone, owner record and copy remain.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "accounts/u4"), { name: "Four" });
  await setDoc(doc(db, "accounts/u4/memberships/c4"), { clubName: "c4", role: "owner", joinedAt: 1 });
  await setDoc(doc(db, "accounts/u5"), { name: "Five" });
  await setDoc(doc(db, "accounts/u5/memberships/c5"), { clubName: "c5", role: "owner", joinedAt: 1 });
  await setDoc(doc(db, "clubs/c5/members/u5"), { role: "owner", name: "Five", joinedAt: 1 });
});
await deleteClubData(real("u5"), "c5", "u5");
assert.equal(await count("clubs/c5/members"), 0, "c5 owner record left behind");
assert.equal(await count("accounts/u5/memberships"), 0, "c5 copy left behind");
await deleteAccountData(real("u4"), "u4"); // used to throw permission-denied
assert.equal(await count("accounts/u4/memberships"), 0, "c4 copy left behind");

// A plain member who deletes their account leaves the club first (no ghost member), even when their
// record or the club's other data is already gone.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "accounts/u7"), { name: "Seven" });
  await setDoc(doc(db, "accounts/u7/memberships/c2"), { clubName: "c2", role: "member", joinedAt: 1 });
  await setDoc(doc(db, "clubs/c2/members/u7"), { role: "member", name: "Seven", joinedAt: 1 });
  await setDoc(doc(db, "accounts/u8"), { name: "Eight" });
  await setDoc(doc(db, "accounts/u8/memberships/c2"), { clubName: "c2", role: "member", joinedAt: 1 }); // no record: was removed
});
assert.equal(await count("clubs/c2/members"), 3);
await deleteAccountData(real("u7"), "u7");
assert.equal(await count("clubs/c2/members"), 2, "u7 is still listed as a member after deleting their account");
assert.equal(await count("accounts/u7/memberships"), 0);
await deleteAccountData(real("u8"), "u8"); // a card with no record
assert.equal(await count("accounts/u8/memberships"), 0);

// Leaving must not hide a failure: if the member record can't be deleted (the owner can't leave a club that
// still exists) the call rejects and the card stays, so the person is never left as a ghost member.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/c9"), { name: "c9", visibility: "public", ownerId: "u9", createdAt: 1 });
  await setDoc(doc(db, "clubs/c9/members/u9"), { role: "owner", name: "Nine", joinedAt: 1 });
  await setDoc(doc(db, "accounts/u9"), { name: "Nine" });
  await setDoc(doc(db, "accounts/u9/memberships/c9"), { clubName: "c9", role: "owner", joinedAt: 1 });
});
await assert.rejects(leaveClub(real("u9"), "c9", "u9"), "leaving as the owner must fail, not be swallowed");
assert.equal(await count("clubs/c9/members"), 1, "the owner's record must still be there");
assert.equal(await count("accounts/u9/memberships"), 1, "the owner's card must not be deleted when the record couldn't be");

console.log("cascade: ok");
await env.cleanup();
