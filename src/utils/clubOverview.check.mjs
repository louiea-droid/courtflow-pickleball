// Run: node src/utils/clubOverview.check.mjs
import assert from "node:assert/strict";
import { fillLine, monthStats, overviewGames } from "./clubOverview.js";

const g = (id, date, extra = {}) => ({ id, date, startTime: "18:00", durationMins: 120, maxPlayers: 8, attendees: [], ...extra });
const events = [
  g("live", "2020-01-01", { status: "live" }),
  g("later", "2099-03-02"),
  g("sooner", "2099-03-01"),
  g("past", "2020-01-02"),
  g("ended", "2099-01-01", { status: "ended" }),
];
const o = overviewGames(events, "Asia/Manila");
assert.deepEqual(o.live.map((e) => e.id), ["live"]);
assert.equal(o.next.id, "sooner");
assert.deepEqual(o.coming.map((e) => e.id), ["later"]);
assert.deepEqual(overviewGames([], "UTC"), { live: [], next: null, coming: [] });
const many = [1, 2, 3, 4, 5, 6].map((n) => g(`e${n}`, `2099-04-0${n}`));
assert.deepEqual(overviewGames(many, "UTC").coming.map((e) => e.id), ["e2", "e3", "e4"]);

const a = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));
assert.deepEqual(monthStats([
  g("m1", "2026-11-03", { maxPlayers: 2, attendees: a(3) }),
  g("m2", "2026-11-20", { attendees: a(2), walkIn: true }),
  g("x", "2026-12-01", { attendees: a(5) }),
], "2026-11-12"), { games: 2, players: 4 });

assert.equal(fillLine(g("f", "2099-01-01", { attendees: a(6) })), "6 of 8 booked · 2 spots left");
assert.equal(fillLine(g("f", "2099-01-01", { attendees: a(7) })), "7 of 8 booked · 1 spot left");
assert.equal(fillLine(g("f", "2099-01-01", { attendees: a(10) })), "Full · 2 waiting");
assert.equal(fillLine(g("f", "2099-01-01", { attendees: a(8) })), "Full");
assert.equal(fillLine(g("f", "2099-01-01", { walkIn: true })), "Walk-in");
assert.equal(fillLine(g("f", "2099-01-01", { maxPlayers: 0, attendees: a(3) })), "3 booked"); // no limit set

console.log("clubOverview.check: ok");
