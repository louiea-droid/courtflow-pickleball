// Firestore rules for friends: the name directory, friend codes and friendships.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { syncDirectory } from "../src/utils/friendsData.js";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where } from "firebase/firestore";

const rules = fs.readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "friends-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anon = env.unauthenticatedContext().firestore();
const quick = env.authenticatedContext("q1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const legacy = env.authenticatedContext("c1", { email: "club1@courtflow.local", firebase: { sign_in_provider: "password" } }).firestore();
const me = real("me"), bea = real("bea"), cy = real("cy"), stranger = real("str");
const now = () => Date.now();
const seed = async (fn) => { await env.clearFirestore(); if (fn) await env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore())); };

// ---- profiles: the name directory (names only, never an email)
await seed(async (db) => {
  await setDoc(doc(db, "profiles/bea"), { name: "Bea", nameLower: "bea" });
  await setDoc(doc(db, "profiles/bob"), { name: "Bob", nameLower: "bob" });
});
await assertSucceeds(setDoc(doc(me, "profiles/me"), { name: "Me", nameLower: "me" }));
await assertSucceeds(setDoc(doc(me, "profiles/me"), { name: "Louie A", nameLower: "louie a" })); // a rename
await assertFails(setDoc(doc(me, "profiles/bea"), { name: "Bea", nameLower: "bea" })); // someone else's
await assertFails(setDoc(doc(me, "profiles/me"), { name: "Me", nameLower: "me", email: "me@example.com" }));
await assertFails(setDoc(doc(me, "profiles/me"), { name: "", nameLower: "" }));
await assertFails(setDoc(doc(me, "profiles/me"), { name: "x".repeat(61), nameLower: "x".repeat(61) }));
await assertFails(setDoc(doc(me, "profiles/me"), { name: "Me", nameLower: "someone else" })); // the key must match the name
await assertFails(setDoc(doc(anon, "profiles/x"), { name: "X", nameLower: "x" }));
await assertFails(setDoc(doc(quick, "profiles/q1"), { name: "Q", nameLower: "q" }));
await assertFails(setDoc(doc(legacy, "profiles/c1"), { name: "C", nameLower: "c" }));
await assertSucceeds(getDoc(doc(cy, "profiles/bea")));
await assertFails(getDoc(doc(anon, "profiles/bea")));
await assertFails(getDoc(doc(quick, "profiles/bea")));
const prefix = (db, from, to, n) => query(collection(db, "profiles"), where("nameLower", ">=", from), where("nameLower", "<=", to), ...(n ? [limit(n)] : []));
await assertSucceeds(getDocs(prefix(cy, "b", "b", 20)));
await assertFails(getDocs(prefix(cy, "b", "b", 21))); // at most 20 at a time
await assertFails(getDocs(prefix(cy, "b", "b"))); // and always with a limit
await assertFails(getDocs(collection(cy, "profiles")));
await assertFails(getDocs(prefix(anon, "b", "b", 20)));
await assertFails(updateDoc(doc(cy, "profiles/bea"), { name: "Evil" }));
await assertFails(deleteDoc(doc(cy, "profiles/bea")));
await assertSucceeds(deleteDoc(doc(bea, "profiles/bea"))); // turning "find me by name" off

// ---- friendCodes: one lookup at a time, never a list
await seed();
await assertSucceeds(setDoc(doc(me, "friendCodes/K7M2QXWA"), { uid: "me", name: "Me" }));
await assertFails(setDoc(doc(me, "friendCodes/k7m2qxwa"), { uid: "me", name: "Me" })); // lower case
await assertFails(setDoc(doc(me, "friendCodes/K7M2QXW0"), { uid: "me", name: "Me" })); // 0 is not in the alphabet
await assertFails(setDoc(doc(me, "friendCodes/K7M2QXW"), { uid: "me", name: "Me" })); // too short
await assertFails(setDoc(doc(me, "friendCodes/ABCDEFGH"), { uid: "bea", name: "Me" })); // someone else's uid
await assertFails(setDoc(doc(me, "friendCodes/ABCDEFGH"), { uid: "me", name: "Me", email: "x" }));
await assertFails(setDoc(doc(me, "friendCodes/ABCDEFGH"), { uid: "me", name: "" }));
await assertFails(setDoc(doc(anon, "friendCodes/ABCDEFGH"), { uid: "x", name: "X" }));
await assertFails(setDoc(doc(quick, "friendCodes/ABCDEFGH"), { uid: "q1", name: "Q" }));
await assertFails(setDoc(doc(legacy, "friendCodes/ABCDEFGH"), { uid: "c1", name: "C" }));
await assertSucceeds(getDoc(doc(bea, "friendCodes/K7M2QXWA")));
await assertFails(getDoc(doc(anon, "friendCodes/K7M2QXWA")));
await assertFails(getDocs(collection(bea, "friendCodes"))); // nobody lists the codes
await assertFails(setDoc(doc(bea, "friendCodes/K7M2QXWA"), { uid: "bea", name: "Bea" })); // can't take over someone's code
await assertFails(updateDoc(doc(bea, "friendCodes/K7M2QXWA"), { name: "Evil" }));
await assertFails(deleteDoc(doc(bea, "friendCodes/K7M2QXWA")));
await assertSucceeds(updateDoc(doc(me, "friendCodes/K7M2QXWA"), { name: "Louie A" })); // a rename
await assertFails(updateDoc(doc(me, "friendCodes/K7M2QXWA"), { uid: "bea" })); // never handed over
await assertSucceeds(deleteDoc(doc(me, "friendCodes/K7M2QXWA")));

// ---- friendships/{a_b}: a request, its answer, and who can see it
const pair = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const req = (from, to, extra = {}) => ({
  users: [from, to].sort(), names: { [from]: from, [to]: to }, status: "pending", requestedBy: from, createdAt: now(), ...extra,
});
const fdoc = (db, a, b) => doc(db, `friendships/${pair(a, b)}`);
await seed();
await assertSucceeds(setDoc(fdoc(me, "me", "bea"), req("me", "bea")));
await seed();
await assertFails(setDoc(fdoc(stranger, "me", "bea"), req("me", "bea"))); // not one of the two
await assertFails(setDoc(doc(me, "friendships/me_bea"), req("me", "bea"))); // the id must be the sorted pair
await assertFails(setDoc(doc(me, "friendships/bea_me"), { ...req("me", "bea"), users: ["me", "bea"] })); // users not sorted
await assertFails(setDoc(fdoc(me, "me", "bea"), req("bea", "me"))); // asking in someone else's name
await assertFails(setDoc(fdoc(me, "me", "bea"), req("me", "bea", { status: "accepted" })));
await assertFails(setDoc(fdoc(me, "me", "bea"), req("me", "bea", { extra: 1 })));
await assertFails(setDoc(fdoc(me, "me", "bea"), req("me", "bea", { users: ["bea", "cy", "me"] })));
await assertFails(setDoc(doc(me, "friendships/me_me"), { ...req("me", "me"), users: ["me", "me"] })); // yourself
await assertFails(setDoc(fdoc(me, "me", "bea"), req("me", "bea", { names: { me: "x".repeat(61), bea: "Bea" } })));
await assertFails(setDoc(fdoc(me, "me", "bea"), req("me", "bea", { names: { me: "Me" } }))); // both names
await assertFails(setDoc(fdoc(me, "me", "bea"), req("me", "bea", { names: { me: "Me", bea: "Bea", cy: "Cy" } })));
await assertFails(setDoc(fdoc(me, "me", "bea"), req("me", "bea", { createdAt: 1 }))); // stale
await assertFails(setDoc(fdoc(anon, "x", "bea"), req("x", "bea")));
await assertFails(setDoc(fdoc(quick, "q1", "bea"), req("q1", "bea")));
await assertFails(setDoc(fdoc(legacy, "c1", "bea"), req("c1", "bea")));

// reading
await seed(async (db) => { await setDoc(fdoc(db, "me", "bea"), req("me", "bea")); });
await assertSucceeds(getDoc(fdoc(me, "me", "bea")));
await assertSucceeds(getDoc(fdoc(bea, "me", "bea")));
await assertFails(getDoc(fdoc(stranger, "me", "bea")));
await assertFails(getDoc(fdoc(anon, "me", "bea")));
await assertSucceeds(getDocs(query(collection(me, "friendships"), where("users", "array-contains", "me"))));
await assertFails(getDocs(query(collection(me, "friendships"), where("users", "array-contains", "bea")))); // someone else's list
await assertFails(getDocs(collection(me, "friendships")));

// answering: only the other person accepts, and only the status changes
await assertFails(updateDoc(fdoc(me, "me", "bea"), { status: "accepted" })); // the sender can't accept their own
await assertFails(updateDoc(fdoc(stranger, "me", "bea"), { status: "accepted" }));
await assertFails(updateDoc(fdoc(bea, "me", "bea"), { status: "accepted", names: { me: "Evil", bea: "Bea" } }));
await assertFails(updateDoc(fdoc(bea, "me", "bea"), { status: "accepted", requestedBy: "bea" }));
await assertFails(updateDoc(fdoc(bea, "me", "bea"), { status: "declined" }));
await assertFails(updateDoc(fdoc(bea, "me", "bea"), { "names.me": "Evil" })); // never someone else's name
await assertSucceeds(updateDoc(fdoc(me, "me", "bea"), { "names.me": "Louie A" })); // your own
await assertSucceeds(updateDoc(fdoc(bea, "me", "bea"), { "names.bea": "Beatrice" }));
await assertFails(updateDoc(fdoc(me, "me", "bea"), { "names.cy": "Cy" })); // a third key
await assertSucceeds(updateDoc(fdoc(bea, "me", "bea"), { status: "accepted" }));
await assertFails(updateDoc(fdoc(bea, "me", "bea"), { status: "pending" })); // never back
await assertFails(updateDoc(fdoc(me, "me", "bea"), { status: "pending" }));

// leaving: either person removes (cancel, decline, unfriend), nobody else
await assertFails(deleteDoc(fdoc(stranger, "me", "bea")));
await assertFails(deleteDoc(fdoc(anon, "me", "bea")));
await assertSucceeds(deleteDoc(fdoc(bea, "me", "bea")));
await assertSucceeds(setDoc(fdoc(me, "me", "bea"), req("me", "bea"))); // and a new request can follow
await assertSucceeds(deleteDoc(fdoc(me, "me", "bea")));

// ---- syncDirectory: what a client publishes, and that one broken friendship can't block it
await seed(async (db) => {
  await setDoc(doc(db, "accounts/me"), { name: "Me" });
  await setDoc(fdoc(db, "me", "bea"), req("me", "bea"));
  await setDoc(doc(db, "friendships/cy_me"), { users: ["cy", "me"], status: "pending", requestedBy: "cy", createdAt: 1 }); // no names: an update to it is refused
});
const readAs = async (path) => { let snap; await env.withSecurityRulesDisabled(async (ctx) => { snap = await getDoc(doc(ctx.firestore(), path)); }); return snap; };
await syncDirectory(me, "me", { name: "Me" });
const acct1 = (await readAs("accounts/me")).data();
if (!/^[A-Z2-9]{8}$/.test(acct1.friendCode || "")) throw new Error("sync did not make a friend code");
if ((await readAs("friendCodes/" + acct1.friendCode)).data()?.uid !== "me") throw new Error("code doc missing");
if ((await readAs("profiles/me")).data()?.nameLower !== "me") throw new Error("name listing missing");
// turning the listing off and renaming must complete even though one friendship can't be updated
await syncDirectory(me, "me", { ...acct1, name: "Mia", discoverable: false });
const acct2 = (await readAs("accounts/me")).data();
if (acct2.directory.name !== "Mia" || acct2.directory.discoverable !== false) throw new Error("account note not updated");
if ((await readAs("profiles/me")).exists()) throw new Error("name still listed after turning the listing off");
if ((await readAs("friendCodes/" + acct1.friendCode)).data()?.name !== "Mia") throw new Error("code doc not renamed");
if ((await readAs("friendships/bea_me")).data()?.names?.me !== "Mia") throw new Error("friendship name not refreshed");
if (acct2.friendCode !== acct1.friendCode) throw new Error("the friend code must never change");

console.log("friends: all assertions passed");
await env.cleanup();
