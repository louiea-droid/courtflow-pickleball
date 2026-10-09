// Firestore rules for the club chat: chats/club_{clubId} and its messages.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";

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

// ---- Messages: a member writes as themselves
await seed();
await assertSucceeds(setDoc(m(mem, "a1"), msg("mem")));
await assertSucceeds(setDoc(m(mgr, "a2"), msg("mgr")));
await assertSucceeds(setDoc(m(mem, "a3"), msg("mem", { text: "x".repeat(1000) })));
await assertFails(setDoc(m(mem, "b1"), msg("mem2"))); // another person's uid
await assertFails(setDoc(m(mem, "b2"), msg("mem", { name: "x".repeat(61) })));
await assertFails(setDoc(m(mem, "b3"), msg("mem", { name: "" })));
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

await env.cleanup();
console.log("chat rules: ok");
