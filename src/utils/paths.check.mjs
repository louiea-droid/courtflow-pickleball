// Self-check for session base paths. Run: node src/utils/paths.check.mjs
import assert from "node:assert";
import { eventBase, sessionBase } from "./paths.js";

assert.deepEqual(sessionBase("u1"), ["sessions", "u1"]);
assert.deepEqual(eventBase("c1", "e1"), ["clubs", "c1", "events", "e1"]);
// Not known yet (still signing in, or no event chosen): no base, so hooks load nothing.
assert.equal(sessionBase(null), null);
assert.equal(sessionBase(""), null);
assert.equal(eventBase("c1", undefined), null);
assert.equal(eventBase(undefined, "e1"), null);

console.log("paths.check: ok");
