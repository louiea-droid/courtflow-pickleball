// Firestore rules for Find session: events of public clubs can be listed across all clubs (collection-group query).
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collectionGroup, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from "firebase/firestore";

const rules = fs.readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "sessions-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anon = env.unauthenticatedContext().firestore();
const quick = env.authenticatedContext("q1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const legacy = env.authenticatedContext("c1", { email: "club1@courtflow.local", firebase: { sign_in_provider: "password" } }).firestore();
const own = real("own"), mem = real("mem"), stranger = real("stranger");

await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const id of ["pub", "priv"]) {
    await setDoc(doc(db, `clubs/${id}`), { name: id, nameLower: id, visibility: id === "pub" ? "public" : "private", ownerId: "own", createdAt: 1 });
    await setDoc(doc(db, `clubs/${id}/members/own`), { role: "owner", name: "own", joinedAt: 1 });
    await setDoc(doc(db, `clubs/${id}/members/mem`), { role: "member", name: "mem", joinedAt: 1 });
  }
  const event = { title: "Open play", date: "2026-10-10", startTime: "09:00", durationMins: 60, maxPlayers: 8, attendees: [], status: "scheduled", timeZone: "UTC" };
  await setDoc(doc(db, "clubs/pub/events/e1"), { ...event, clubPublic: true, clubId: "pub", clubName: "pub", clubLocation: "" });
  await setDoc(doc(db, "clubs/pub/events/e2"), event); // an old event: no copy of the club yet
  await setDoc(doc(db, "clubs/priv/events/e1"), { ...event, clubPublic: false, clubId: "priv", clubName: "priv", clubLocation: "" });
});

const asked = (db) => getDocs(query(collectionGroup(db, "events"), where("clubPublic", "==", true), where("date", ">=", "2026-10-01"), orderBy("date")));

// The query Find session runs: allowed for anyone (it is public data, like the public booking page), and only public clubs' events come back.
for (const [, db] of [["a real person", stranger], ["anonymous", anon], ["quick session", quick], ["old club login", legacy]]) {
  const snap = await assertSucceeds(asked(db));
  if (snap.docs.map((d) => d.ref.path).join() !== "clubs/pub/events/e1") throw new Error("expected only pub/e1, got " + snap.docs.map((d) => d.ref.path));
}

// A query that doesn't say clubPublic == true is refused, so no one can list private events this way.
await assertFails(getDocs(collectionGroup(stranger, "events")));
await assertFails(getDocs(query(collectionGroup(stranger, "events"), where("clubPublic", "==", false))));
await assertFails(getDocs(query(collectionGroup(stranger, "events"), where("date", ">=", "2026-10-01"))));
// Reading one private event directly is still members-only; an unflagged old event is not exposed by the new rule.
await assertFails(getDoc(doc(stranger, "clubs/priv/events/e1")));
await assertSucceeds(getDoc(doc(mem, "clubs/priv/events/e1")));
// The new rule is read-only: nobody writes through it.
await assertFails(updateDoc(doc(stranger, "clubs/pub/events/e1"), { title: "Mine" }));
await assertFails(setDoc(doc(stranger, "clubs/pub/events/e9"), { clubPublic: true, title: "x", date: "2026-10-10" }));
await assertFails(updateDoc(doc(mem, "clubs/pub/events/e1"), { clubPublic: false })); // a plain member can't change the copy
// A club's owner (a manager) can keep the copy true.
await assertSucceeds(updateDoc(doc(own, "clubs/pub/events/e2"), { clubPublic: true, clubId: "pub", clubName: "pub", clubLocation: "" }));

await env.cleanup();
console.log("sessions rules: ok");
