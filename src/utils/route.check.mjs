// Self-check for page routing. Run: node src/utils/route.check.mjs
import assert from "node:assert";
import { chatIdOf, clubIdOf, eventIdOf, routeOf } from "./route.js";

assert.equal(routeOf("/"), "hub");
assert.equal(routeOf(""), "hub");
assert.equal(routeOf("/settings"), "settings");
assert.equal(routeOf("/settings/"), "settings");
assert.equal(routeOf("/live"), "live");
assert.equal(routeOf("/open-play"), "open-play");
assert.equal(routeOf("/open-play/"), "open-play");
assert.equal(routeOf("/umpire"), "umpire");
assert.equal(routeOf("/umpire/"), "umpire");
// The quick session keeps its URL; its route is named "quick" so "club" can mean a real club.
assert.equal(routeOf("/club"), "quick");
assert.equal(routeOf("/club/"), "quick");
assert.equal(routeOf("/clubhouse"), "hub");

assert.equal(routeOf("/clubs"), "clubs");
assert.equal(routeOf("/friends"), "friends");
assert.equal(routeOf("/friends/"), "friends");
assert.equal(routeOf("/friendsx"), "hub");
assert.equal(routeOf("/clubs/"), "clubs");
assert.equal(routeOf("/clubs/new"), "clubs-new");
assert.equal(routeOf("/clubs/abc"), "club");
assert.equal(routeOf("/clubs/abc/"), "club");
assert.equal(routeOf("/clubs/abc/host"), "club-host");
assert.equal(routeOf("/clubs/abc/settings"), "club-settings");
assert.equal(routeOf("/clubs/abc/announcements"), "club-announcements");
assert.equal(routeOf("/clubs/abc/announcements/"), "club-announcements");
assert.equal(routeOf("/clubs/abc/chat"), "hub");
assert.equal(routeOf("/clubs/abc/event/e1"), "club-event");
assert.equal(routeOf("/clubs/abc/event/e1/"), "club-event");
assert.equal(routeOf("/clubs/abc/event/e1/game"), "club-game");
assert.equal(routeOf("/clubs/abc/event/e1/game/"), "club-game");

// Review Focus 5: unknown paths and the old pre-club URLs land on the hub, not a blank page.
assert.equal(routeOf("/clubs/abc/nope"), "hub");
assert.equal(routeOf("/clubs/abc/event"), "hub");
assert.equal(routeOf("/clubs/abc/event/e1/gamex"), "hub");
assert.equal(routeOf("/clubs/abc/event/e1/game/x"), "hub");
assert.equal(routeOf("/nope"), "hub");
assert.equal(routeOf("/host"), "hub");
assert.equal(routeOf("/event/abc"), "hub");
assert.equal(routeOf("/settings/extra"), "hub");

assert.equal(clubIdOf("/clubs/abc"), "abc");
assert.equal(clubIdOf("/clubs/abc/host"), "abc");
assert.equal(clubIdOf("/clubs/abc/event/e1/game"), "abc");
assert.equal(clubIdOf("/clubs/a%20b/"), "a b");
assert.equal(clubIdOf("/clubs"), null);
assert.equal(clubIdOf("/clubs/new"), null);
assert.equal(clubIdOf("/club"), null);
assert.equal(clubIdOf("/"), null);

assert.equal(eventIdOf("/clubs/c1/event/e1"), "e1");
assert.equal(eventIdOf("/clubs/c1/event/e1/game"), "e1");
assert.equal(eventIdOf("/clubs/c1/event/abc%20x/game/"), "abc x");
assert.equal(eventIdOf("/clubs/c1/host"), null);
// The read-only queue page of a live game
assert.equal(routeOf("/clubs/abc/event/e1/queue"), "club-queue");
assert.equal(routeOf("/clubs/abc/event/e1/queue/"), "club-queue");
assert.equal(routeOf("/clubs/abc/event/e1/game"), "club-game");
assert.equal(routeOf("/clubs/abc/event/e1/other"), "hub");
assert.equal(eventIdOf("/clubs/c1/event/e1/queue"), "e1");
assert.equal(eventIdOf("/clubs/c1/event/"), null);
assert.equal(eventIdOf("/clubs/c1/event/e1/gamex"), null);

// Part B routes. "find" is not a club id.
assert.equal(routeOf("/clubs/find"), "clubs-find");
assert.equal(routeOf("/clubs/find/"), "clubs-find");
assert.equal(routeOf("/clubs/abc/members"), "club-members");
assert.equal(routeOf("/clubs/abc/members/"), "club-members");
assert.equal(routeOf("/clubs/abc/members/x"), "hub");
assert.equal(clubIdOf("/clubs/find"), null);
assert.equal(clubIdOf("/clubs/abc/members"), "abc");

assert.equal(routeOf("/inbox"), "inbox");
assert.equal(routeOf("/inbox/club_abc"), "inbox");
assert.equal(routeOf("/inbox/club_abc/"), "inbox");
assert.equal(routeOf("/inbox/a/b"), "hub");
assert.equal(chatIdOf("/inbox/club_abc"), "club_abc");
assert.equal(chatIdOf("/inbox"), null);
assert.equal(chatIdOf("/inbox/a%20b/"), "a b");
assert.equal(chatIdOf("/friends"), null);

// A malformed %-escape in the address must not throw (it would blank the whole app)
assert.equal(chatIdOf("/inbox/%E0"), "%E0");
assert.equal(clubIdOf("/clubs/%E0/members"), "%E0");
assert.equal(eventIdOf("/clubs/abc/event/%E0"), "%E0");

assert.equal(routeOf("/sessions"), "sessions");
assert.equal(routeOf("/sessions/"), "sessions");
assert.equal(routeOf("/sessionsx"), "hub");

assert.equal(routeOf("/help"), "help");
assert.equal(routeOf("/help/"), "help");
assert.equal(routeOf("/helpx"), "hub");

console.log("route.check: ok");
