// Self-check for routing. Run: node src/utils/route.check.mjs
import assert from "node:assert";
import { routeOf } from "./route.js";

assert.equal(routeOf("/"), "hub");
assert.equal(routeOf(""), "hub");
assert.equal(routeOf("/settings"), "settings");
assert.equal(routeOf("/settings/"), "settings");
assert.equal(routeOf("/club"), "club");
assert.equal(routeOf("/club/"), "club");
assert.equal(routeOf("/live"), "live");
assert.equal(routeOf("/open-play"), "open-play");
assert.equal(routeOf("/open-play/"), "open-play");
// Unknown paths fall back to the hub rather than a blank page.
assert.equal(routeOf("/nope"), "hub");
assert.equal(routeOf("/settings/extra"), "hub");
assert.equal(routeOf("/clubhouse"), "hub");

console.log("route.check: ok");
