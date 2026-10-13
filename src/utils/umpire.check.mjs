// Self-check for the umpire link. Run: node src/utils/umpire.check.mjs
import assert from "node:assert";
import { umpireTarget, umpireUrl } from "./umpire.js";

const event = ["clubs", "c1", "events", "e 1"];
const url = umpireUrl("https://x.test", event, "ABCD2345");
assert.equal(url, "https://x.test/umpire?club=c1&event=e%201&code=ABCD2345");
assert.deepEqual(umpireTarget(new URL(url).search), { base: event, code: "ABCD2345" });
const quick = umpireUrl("https://x.test", ["sessions", "u1"], "ABCD2345");
assert.equal(quick, "https://x.test/umpire?session=u1&code=ABCD2345");
assert.deepEqual(umpireTarget(new URL(quick).search), { base: ["sessions", "u1"], code: "ABCD2345" });
// A mangled or half-copied link is no target, never a crash.
for (const bad of ["", "?code=ABCD2345", "?club=c1&code=ABCD2345", "?club=c1&event=e1", "?session=u1", "?session=&code=x"]) {
  assert.equal(umpireTarget(bad), null, bad);
}
console.log("umpire link checks passed");
