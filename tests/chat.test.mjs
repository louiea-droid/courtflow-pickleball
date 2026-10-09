// Firestore rules for the club chat: chats/club_{clubId} and its messages.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

const rules = fs.readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "chat-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anon = env.unauthenticatedContext().firestore();
const quick = env.authenticatedContext("q1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const legacy = env.authenticatedContext("c1", { email: "club1@courtflow.local", firebase: { sign_in_provider: "password" } }).firestore();
const own = real("own"), mgr = real("mgr"), mem = real("mem"), mem2 = real("mem2"), stranger = real("stranger");
const now = () => Date.now();
const DAY = 86400000;

// Clubs "pub" and "priv": owner, a manager, two members. A chat already exists on "pub" with one message from mem2.
async function seed({ chat = true } = {}) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const id of ["pub", "priv"]) {
      await setDoc(doc(db, `clubs/${id}`), { name: id, nameLower: id, visibility: id === "pub" ? "public" : "private", ownerId: "own", createdAt: 1 });
      const people = { own: "owner", mgr: "manager", mem: "member", mem2: "member" };
      for (const [uid, role] of Object.entries(people)) await setDoc(doc(db, `clubs/${id}/members/${uid}`), { role, name: uid, joinedAt: 1 });
    }
    if (chat) {
      for (const id of ["pub", "priv"]) await setDoc(doc(db, `chats/club_${id}`), { kind: "club", clubId: id, title: id, lastText: "", lastAt: 0, lastBy: "", createdAt: 1 });
      await setDoc(doc(db, "chats/club_pub/messages/m2"), { from: "mem2", name: "mem2", text: "hello", createdAt: now() });
    }
  });
}
const chatDoc = (id = "pub", extra = {}) => ({ kind: "club", clubId: id, title: id, lastText: "", lastAt: 0, lastBy: "", createdAt: now(), ...extra });
const msg = (uid, extra = {}) => ({ from: uid, name: uid, text: "hi there", createdAt: now(), ...extra });
const m = (db, id) => doc(db, `chats/club_pub/messages/${id}`);
const outsiders = [["a stranger", stranger], ["anonymous", anon], ["quick session", quick], ["old club login", legacy]];

// ---- Starting the chat: a manager only, with exactly these fields
await seed({ chat: false });
await assertSucceeds(setDoc(doc(mgr, "chats/club_pub"), chatDoc("pub")));
await seed({ chat: false });
await assertSucceeds(setDoc(doc(own, "chats/club_pub"), chatDoc("pub")));
await seed({ chat: false });
await assertFails(setDoc(doc(mem, "chats/club_pub"), chatDoc("pub"))); // a plain member can't
for (const [, db] of outsiders) await assertFails(setDoc(doc(db, "chats/club_pub"), chatDoc("pub")));
await assertFails(setDoc(doc(mgr, "chats/club_other"), chatDoc("pub"))); // the id must match the club
await assertFails(setDoc(doc(mgr, "chats/club_pub"), chatDoc("pub", { kind: "dm" })));
await assertFails(setDoc(doc(mgr, "chats/club_pub"), chatDoc("pub", { extra: 1 })));
await assertFails(setDoc(doc(mgr, "chats/club_pub"), chatDoc("pub", { title: "x".repeat(61) })));
await assertFails(setDoc(doc(mgr, "chats/club_pub"), chatDoc("pub", { title: "" })));
await assertFails(setDoc(doc(mgr, "chats/club_pub"), chatDoc("pub", { lastText: "forged", lastAt: now(), lastBy: "mgr" })));
await assertFails(setDoc(doc(mgr, "chats/club_pub"), chatDoc("pub", { createdAt: now() - DAY })));
await assertFails(setDoc(doc(mgr, "chats/club_noclub"), chatDoc("noclub"))); // not a manager of a club that doesn't exist

// ---- A chat that isn't there yet: a member's listener must survive until a manager starts it (a refused
// read ends a listener for good), so members may "get" the missing document. Nobody else may.
await seed({ chat: false });
for (const db of [mem, mgr, own]) await assertSucceeds(getDoc(doc(db, "chats/club_pub")));
for (const [, db] of outsiders) await assertFails(getDoc(doc(db, "chats/club_pub")));
await assertFails(getDoc(doc(mem, "chats/club_nosuchclub")));
await assertFails(getDoc(doc(mem, "chats/dm_a_b")));

// ---- Reading: members only, and only their own club's chat
await seed();
for (const [who, db] of [["mem", mem], ["mgr", mgr], ["own", own]]) {
  await assertSucceeds(getDoc(doc(db, "chats/club_pub")));
  await assertSucceeds(getDocs(collection(db, "chats/club_pub/messages")));
  void who;
}
for (const [, db] of outsiders) {
  await assertFails(getDoc(doc(db, "chats/club_pub")));
  await assertFails(getDocs(collection(db, "chats/club_pub/messages")));
  await assertFails(getDoc(m(db, "m2")));
}
await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "clubs/priv/members/mem"))); // mem is in pub only
await assertFails(getDoc(doc(mem, "chats/club_priv")));
await assertFails(getDocs(collection(mem, "chats/club_priv/messages")));

// ---- The last line on the chat: tail fields only, as yourself, at about the current time
await seed();
const tail = (uid, extra = {}) => ({ lastText: "hi there", lastAt: now(), lastBy: uid, ...extra });
await assertSucceeds(updateDoc(doc(mem, "chats/club_pub"), tail("mem")));
await assertSucceeds(updateDoc(doc(mgr, "chats/club_pub"), tail("mgr")));
await assertFails(updateDoc(doc(mem, "chats/club_pub"), tail("mem2"))); // as someone else
await assertFails(updateDoc(doc(mem, "chats/club_pub"), tail("mem", { lastAt: now() - DAY }))); // stale
await assertFails(updateDoc(doc(mem, "chats/club_pub"), tail("mem", { lastText: "x".repeat(101) })));
await assertFails(updateDoc(doc(mem, "chats/club_pub"), tail("mem", { title: "Mine now" })));
await assertFails(updateDoc(doc(mem, "chats/club_pub"), tail("mem", { clubId: "priv" })));
await assertFails(updateDoc(doc(mem, "chats/club_pub"), tail("mem", { kind: "dm" })));
await assertFails(updateDoc(doc(mem, "chats/club_pub"), tail("mem", { extra: 1 })));
for (const [, db] of outsiders) await assertFails(updateDoc(doc(db, "chats/club_pub"), tail("mem")));

// ---- Rewriting only the preview text (after the newest message is deleted): the line's author or a manager, nothing else changes
await seed();
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "chats/club_pub"), { kind: "club", clubId: "pub", title: "pub", lastText: "bye", lastAt: now() - DAY, lastBy: "mem2", createdAt: 1 }));
await assertSucceeds(updateDoc(doc(mem2, "chats/club_pub"), { lastText: "Message deleted" })); // its author
await assertSucceeds(updateDoc(doc(mgr, "chats/club_pub"), { lastText: "Message deleted" })); // a manager
await assertFails(updateDoc(doc(mem, "chats/club_pub"), { lastText: "forged" })); // another plain member
await assertFails(updateDoc(doc(mgr, "chats/club_pub"), { lastText: "x".repeat(101) }));
await assertFails(updateDoc(doc(stranger, "chats/club_pub"), { lastText: "forged" }));
await assertFails(updateDoc(doc(mgr, "chats/club_pub"), { lastText: "ok", title: "Mine" })); // only the preview

// ---- Messages: a member writes as themselves
await seed();
await assertSucceeds(setDoc(m(mem, "a1"), msg("mem")));
await assertSucceeds(setDoc(m(mgr, "a2"), msg("mgr")));
await assertSucceeds(setDoc(m(mem, "a3"), msg("mem", { text: "x".repeat(1000) })));
await assertFails(setDoc(m(mem, "b1"), msg("mem2"))); // another person's uid
await assertFails(setDoc(m(mem, "b2"), msg("mem", { name: "x".repeat(61) })));
await assertFails(setDoc(m(mem, "b3"), msg("mem", { name: "" })));
await assertFails(setDoc(m(mem, "b3b"), msg("mem", { name: "Club owner" }))); // someone else's name (or any name that isn't yours)
await assertFails(setDoc(m(mem, "b3c"), msg("mem", { name: "mem2" })));
await assertFails(setDoc(m(mem, "b4"), msg("mem", { text: "" })));
await assertFails(setDoc(m(mem, "b5"), msg("mem", { text: "x".repeat(1001) })));
await assertFails(setDoc(m(mem, "b6"), msg("mem", { extra: 1 })));
await assertFails(setDoc(m(mem, "b7"), msg("mem", { createdAt: now() - DAY }))); // back-dated
await assertFails(setDoc(m(mem, "b8"), msg("mem", { createdAt: now() + DAY })));
await assertFails(setDoc(m(mem, "b9"), msg("mem", { text: 5 })));
for (const [, db] of outsiders) await assertFails(setDoc(m(db, "c1"), msg("stranger")));
// ...and the pair of writes the app sends: the message plus the chat's last line, in one batch
const batch = writeBatch(mem);
batch.set(m(mem, "d1"), msg("mem"));
batch.update(doc(mem, "chats/club_pub"), tail("mem"));
await assertSucceeds(batch.commit());

// A removed member loses the chat on the next request
await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "clubs/pub/members/mem")));
await assertFails(getDoc(doc(mem, "chats/club_pub")));
await assertFails(getDocs(collection(mem, "chats/club_pub/messages")));
await assertFails(setDoc(m(mem, "e1"), msg("mem")));
await assertFails(updateDoc(doc(mem, "chats/club_pub"), tail("mem")));

// ---- Edits and deletes
await seed();
await assertSucceeds(setDoc(m(mem, "own1"), msg("mem")));
for (const db of [mem, mem2, mgr, own]) await assertFails(updateDoc(m(db, "own1"), { text: "edited" })); // nobody edits
await assertFails(deleteDoc(m(mem2, "own1"))); // another plain member
await assertFails(deleteDoc(m(stranger, "own1")));
await assertFails(deleteDoc(m(anon, "own1")));
await assertSucceeds(deleteDoc(m(mem, "own1"))); // the author
await assertSucceeds(deleteDoc(m(mgr, "m2"))); // a manager moderates
await seed();
await assertSucceeds(deleteDoc(m(own, "m2"))); // so does the owner
// An author who has left can no longer delete, but a manager still can
await seed();
await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), "clubs/pub/members/mem2")));
await assertFails(deleteDoc(m(mem2, "m2")));
await assertSucceeds(deleteDoc(m(mgr, "m2")));

// ---- Deleting the chat itself: the owner only
await seed();
await assertFails(deleteDoc(doc(mgr, "chats/club_pub")));
await assertFails(deleteDoc(doc(mem, "chats/club_pub")));
await assertFails(deleteDoc(doc(stranger, "chats/club_pub")));
await assertSucceeds(deleteDoc(doc(own, "chats/club_pub")));

// ---- Read positions: the owner's only
await seed();
await assertSucceeds(setDoc(doc(mem, "accounts/mem/chatReads/club_pub"), { at: now() }));
await assertSucceeds(getDoc(doc(mem, "accounts/mem/chatReads/club_pub")));
await assertFails(getDoc(doc(mem2, "accounts/mem/chatReads/club_pub")));
await assertFails(setDoc(doc(mem2, "accounts/mem/chatReads/club_pub"), { at: 1 }));
await assertFails(getDoc(doc(anon, "accounts/mem/chatReads/club_pub")));

// =====================================================================================
// Direct messages: chats/dm_{lo}_{hi}
// =====================================================================================
const me = real("me"), bea = real("bea"), cy = real("cy"), dan = real("dan");
// me and bea share club "pub" (me is only a member there); me and cy are accepted friends; bea and cy have a pending request.
// mgr manages "pub" too (a manager of the shared club must not be able to read a direct conversation).
async function seedDm() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "clubs/pub"), { name: "pub", nameLower: "pub", visibility: "public", ownerId: "own", createdAt: 1 });
    for (const [uid, role] of [["own", "owner"], ["mgr", "manager"], ["me", "member"], ["bea", "member"]]) await setDoc(doc(db, `clubs/pub/members/${uid}`), { role, name: uid, joinedAt: 1 });
    await setDoc(doc(db, "clubs/other"), { name: "other", nameLower: "other", visibility: "public", ownerId: "own", createdAt: 1 });
    await setDoc(doc(db, "clubs/other/members/me"), { role: "member", name: "me", joinedAt: 1 }); // only me is in "other"
    await setDoc(doc(db, "friendships/cy_me"), { users: ["cy", "me"], names: { me: "me", cy: "cy" }, status: "accepted", requestedBy: "me", createdAt: 1 });
    await setDoc(doc(db, "friendships/bea_cy"), { users: ["bea", "cy"], names: { bea: "bea", cy: "cy" }, status: "pending", requestedBy: "bea", createdAt: 1 });
  });
}
const dm = (a, b, extra = {}) => ({ kind: "dm", members: [a, b].sort(), names: { [a]: a, [b]: b }, lastText: "", lastAt: 0, lastBy: "", createdAt: now(), ...extra });
const dmRef = (db, a, b) => doc(db, `chats/dm_${[a, b].sort().join("_")}`);

await seedDm();
await assertSucceeds(setDoc(dmRef(me, "me", "cy"), dm("me", "cy"))); // accepted friends
await assertSucceeds(setDoc(dmRef(me, "me", "bea"), dm("me", "bea", { viaClub: "pub" }))); // members of the same club
await seedDm();
await assertFails(setDoc(dmRef(me, "me", "bea"), dm("me", "bea"))); // not friends, no club named
await assertFails(setDoc(dmRef(bea, "bea", "cy"), dm("bea", "cy"))); // a request that is still pending
await assertFails(setDoc(dmRef(me, "me", "bea"), dm("me", "bea", { viaClub: "other" }))); // a club the two don't share (only me is in it)
await assertFails(setDoc(dmRef(me, "me", "dan"), dm("me", "dan", { viaClub: "pub" }))); // dan isn't in pub
await assertFails(setDoc(dmRef(dan, "me", "bea"), dm("me", "bea", { viaClub: "pub" }))); // dan makes one for two other people
await assertFails(setDoc(dmRef(me, "me", "dan"), dm("me", "dan"))); // a stranger
await assertFails(setDoc(doc(me, "chats/dm_me_me"), { ...dm("me", "me"), members: ["me", "me"], names: { me: "me" } })); // yourself
await assertFails(setDoc(doc(me, "chats/dm_me_cy"), dm("me", "cy"))); // an id that isn't dm_lo_hi (the right one is dm_cy_me)
await assertFails(setDoc(doc(me, "chats/dm_me_cy"), { ...dm("me", "cy"), members: ["me", "cy"] })); // unsorted members
await assertFails(setDoc(dmRef(me, "me", "cy"), dm("me", "cy", { extra: 1 })));
await assertFails(setDoc(dmRef(me, "me", "cy"), dm("me", "cy", { lastAt: now() })));
await assertFails(setDoc(dmRef(me, "me", "cy"), dm("me", "cy", { lastText: "forged" })));
await assertFails(setDoc(dmRef(me, "me", "cy"), dm("me", "cy", { createdAt: now() - DAY })));
await assertFails(setDoc(dmRef(me, "me", "cy"), dm("me", "cy", { names: { me: "me" } }))); // a name missing
await assertFails(setDoc(dmRef(me, "me", "cy"), dm("me", "cy", { names: { me: "me", cy: "x".repeat(61) } })));
await assertFails(setDoc(dmRef(me, "me", "cy"), dm("me", "cy", { names: { me: "me", cy: "Someone else" } }))); // not the name on their friendship
await assertFails(setDoc(dmRef(me, "me", "bea"), dm("me", "bea", { viaClub: "pub", names: { me: "me", bea: "Boss" } }))); // not the name on their member record
await assertFails(setDoc(dmRef(me, "me", "cy"), dm("me", "cy", { names: { me: "Louie", cy: "cy" } }))); // nor a false name for yourself
for (const [, db] of [["anonymous", anon], ["quick", quick], ["legacy", legacy]]) await assertFails(setDoc(dmRef(db, "me", "cy"), dm("me", "cy")));

// Reading: the two people only (not a manager of the shared club, not a stranger)
await seedDm();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(dmRef(db, "me", "bea"), dm("me", "bea", { viaClub: "pub" }));
  await setDoc(doc(db, "chats/dm_bea_me/messages/x1"), { from: "bea", name: "bea", text: "hi", createdAt: now() });
});
const mine = (db, uid) => query(collection(db, "chats"), where("members", "array-contains", uid));
for (const db of [me, bea]) {
  await assertSucceeds(getDoc(doc(db, "chats/dm_bea_me")));
  await assertSucceeds(getDocs(collection(db, "chats/dm_bea_me/messages")));
}
await assertSucceeds(getDocs(mine(me, "me")));
await assertSucceeds(getDocs(mine(bea, "bea")));
for (const [, db] of [["cy", cy], ["manager of the shared club", mgr], ["owner of the shared club", own], ["anonymous", anon], ["quick", quick], ["legacy", legacy]]) {
  await assertFails(getDoc(doc(db, "chats/dm_bea_me")));
  await assertFails(getDocs(collection(db, "chats/dm_bea_me/messages")));
}
await assertFails(getDocs(mine(cy, "me"))); // asking for someone else's conversations
await assertFails(getDocs(collection(me, "chats"))); // no unfiltered list
// A person can ask for a conversation that isn't there yet (a missing document must not kill a listener), for their own ids only
await assertSucceeds(getDoc(doc(me, "chats/dm_cy_me")));
await assertFails(getDoc(doc(me, "chats/dm_bea_cy")));
await assertFails(getDoc(doc(cy, "chats/dm_bea_me")));

// Updating the last line: either member, tail only, as yourself
const dmTail = (uid, extra = {}) => ({ lastText: "hey", lastAt: now(), lastBy: uid, ...extra });
await assertSucceeds(updateDoc(doc(me, "chats/dm_bea_me"), dmTail("me")));
await assertSucceeds(updateDoc(doc(bea, "chats/dm_bea_me"), dmTail("bea")));
await assertFails(updateDoc(doc(me, "chats/dm_bea_me"), dmTail("bea"))); // as the other person
await assertFails(updateDoc(doc(me, "chats/dm_bea_me"), dmTail("me", { members: ["me", "cy"] })));
await assertFails(updateDoc(doc(me, "chats/dm_bea_me"), dmTail("me", { names: { me: "Z", bea: "Z" } })));
await assertFails(updateDoc(doc(me, "chats/dm_bea_me"), dmTail("me", { viaClub: "other" })));
await assertFails(updateDoc(doc(cy, "chats/dm_bea_me"), dmTail("cy")));
await assertFails(updateDoc(doc(mgr, "chats/dm_bea_me"), dmTail("mgr")));
await assertSucceeds(updateDoc(doc(bea, "chats/dm_bea_me"), { lastText: "Message deleted" })); // the preview after a delete

// Messages: either member writes as themselves, under the name on the conversation
const dmMsg = (db, id, uid, extra = {}) => setDoc(doc(db, `chats/dm_bea_me/messages/${id}`), { from: uid, name: uid, text: "yo", createdAt: now(), ...extra });
await assertSucceeds(dmMsg(me, "a", "me"));
await assertSucceeds(dmMsg(bea, "b", "bea"));
await assertFails(dmMsg(me, "c", "bea")); // as the other person
await assertFails(dmMsg(me, "d", "me", { name: "bea" })); // under their name
await assertFails(dmMsg(me, "e", "me", { text: "" }));
await assertFails(dmMsg(me, "f", "me", { text: "x".repeat(1001) }));
await assertFails(dmMsg(me, "g", "me", { createdAt: now() - DAY }));
await assertFails(dmMsg(me, "h", "me", { extra: 1 }));
await assertFails(dmMsg(cy, "i", "cy"));
await assertFails(dmMsg(mgr, "j", "mgr"));
await assertFails(dmMsg(anon, "k", "me"));
await assertFails(updateDoc(doc(me, "chats/dm_bea_me/messages/a"), { text: "edited" })); // no edits
// Either member may delete any message in their conversation; nobody else
await assertFails(deleteDoc(doc(cy, "chats/dm_bea_me/messages/a")));
await assertFails(deleteDoc(doc(mgr, "chats/dm_bea_me/messages/a")));
await assertSucceeds(deleteDoc(doc(bea, "chats/dm_bea_me/messages/a"))); // bea deletes me's message
await assertSucceeds(deleteDoc(doc(me, "chats/dm_bea_me/messages/b")));
// Deleting the conversation: either member
await assertFails(deleteDoc(doc(cy, "chats/dm_bea_me")));
await assertFails(deleteDoc(doc(mgr, "chats/dm_bea_me")));
await assertSucceeds(deleteDoc(doc(me, "chats/dm_bea_me")));

// History outlives the link: with the friendship gone and the shared club left, the conversation stays readable and writable
// by both people, but a new conversation that depended on it can't be started.
await seedDm();
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(dmRef(ctx.firestore(), "me", "cy"), dm("me", "cy"));
  await setDoc(dmRef(ctx.firestore(), "me", "bea"), dm("me", "bea", { viaClub: "pub" }));
  await deleteDoc(doc(ctx.firestore(), "friendships/cy_me"));
  await deleteDoc(doc(ctx.firestore(), "clubs/pub/members/bea"));
});
await assertSucceeds(getDoc(doc(me, "chats/dm_cy_me")));
await assertSucceeds(getDoc(doc(cy, "chats/dm_cy_me")));
await assertSucceeds(setDoc(doc(me, "chats/dm_cy_me/messages/z"), { from: "me", name: "me", text: "still here", createdAt: now() }));
await assertSucceeds(getDoc(doc(bea, "chats/dm_bea_me")));
await assertSucceeds(updateDoc(doc(me, "chats/dm_bea_me"), dmTail("me")));
await env.withSecurityRulesDisabled((ctx) => deleteDoc(dmRef(ctx.firestore(), "me", "cy")));
await assertFails(setDoc(dmRef(me, "me", "cy"), dm("me", "cy"))); // the friendship is gone: no new conversation

await env.cleanup();
console.log("chat rules: ok");
