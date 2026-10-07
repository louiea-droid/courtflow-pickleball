// Account delete cascade. Run: npm run test:rules (needs Java and the Firebase CLI).
import assert from "node:assert";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { deleteAccountData } from "../src/utils/accountData.js";

const env = await initializeTestEnvironment({
  projectId: "cascade-test",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});
// withSecurityRulesDisabled resolves to void, so carry the result out in a variable.
const count = async (path) => {
  let n;
  await env.withSecurityRulesDisabled(async (ctx) => { n = (await getDocs(collection(ctx.firestore(), path))).size; });
  return n;
};

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "accounts/u1"), { clubName: "One" });
  await setDoc(doc(db, "accounts/u1/roster/r1"), { name: "Regular" });
  for (const e of ["e1", "e2"]) {
    await setDoc(doc(db, `accounts/u1/events/${e}`), { title: e, attendees: [] });
    for (let i = 0; i < 3; i++) await setDoc(doc(db, `accounts/u1/events/${e}/requests/r${i}`), { name: "Dee", contact: "0917" });
    for (const sub of ["players", "courts", "matchLog", "costs"]) {
      await setDoc(doc(db, `accounts/u1/events/${e}/${sub}/x`), { n: 1 });
    }
  }
  // Another account must be untouched.
  await setDoc(doc(db, "accounts/u2"), { clubName: "Two" });
  await setDoc(doc(db, "accounts/u2/events/e9"), { title: "other" });
  await setDoc(doc(db, "accounts/u2/events/e9/requests/r0"), { name: "Keep", contact: "0918" });
  await setDoc(doc(db, "accounts/u2/events/e9/players/x"), { name: "Keep" });
});

assert.equal(await count("accounts/u1/events/e1/requests"), 3);
await deleteAccountData(env.authenticatedContext("u1", { email: "one@example.com" }).firestore(), "u1");

// Review Focus 3: nothing left, including request subcollections whose parent event is gone.
assert.equal(await count("accounts/u1/roster"), 0);
assert.equal(await count("accounts/u1/events"), 0);
assert.equal(await count("accounts/u1/events/e1/requests"), 0);
assert.equal(await count("accounts/u1/events/e2/requests"), 0);
// Review Focus 4: the game's data goes too, with no orphans holding names or who paid.
for (const e of ["e1", "e2"]) {
  for (const sub of ["players", "courts", "matchLog", "costs"]) {
    assert.equal(await count(`accounts/u1/events/${e}/${sub}`), 0, `${e}/${sub} left behind`);
  }
}
await env.withSecurityRulesDisabled(async (ctx) => {
  assert.equal((await getDocs(collection(ctx.firestore(), "accounts"))).docs.map((d) => d.id).join(), "u2");
});
assert.equal(await count("accounts/u2/events/e9/requests"), 1);
assert.equal(await count("accounts/u2/events/e9/players"), 1);

console.log("cascade: ok");
await env.cleanup();
