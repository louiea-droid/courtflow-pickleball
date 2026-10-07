// Self-check for routing. Run: node src/utils/route.check.mjs
import assert from "node:assert";
import { eventIdOf, routeOf } from "./route.js";

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

// Events: /host is the list, /event/<id> is one event, and the id is recoverable.
assert.equal(routeOf("/host"), "host");
assert.equal(routeOf("/host/"), "host");
assert.equal(routeOf("/event/abc123"), "event");
assert.equal(routeOf("/event/abc123/"), "event");
assert.equal(routeOf("/event"), "hub");
assert.equal(routeOf("/event/"), "hub");
assert.equal(routeOf("/event/a/b"), "hub");
assert.equal(eventIdOf("/event/abc123"), "abc123");
assert.equal(eventIdOf("/event/abc%20x/"), "abc x");
assert.equal(eventIdOf("/host"), null);
assert.equal(eventIdOf("/event/"), null);

// Review Focus 5: the game page is /event/<id>/game; anything deeper or lookalike is the hub.
assert.equal(routeOf("/event/abc123/game"), "game");
assert.equal(routeOf("/event/abc123/game/"), "game");
assert.equal(routeOf("/event/abc123/gamex"), "hub");
assert.equal(routeOf("/event/abc123/game/extra"), "hub");
assert.equal(routeOf("/event/abc123"), "event");
assert.equal(eventIdOf("/event/abc123/game"), "abc123");
assert.equal(eventIdOf("/event/abc%20x/game/"), "abc x");
assert.equal(eventIdOf("/event/abc123/gamex"), null);

console.log("route.check: ok");
