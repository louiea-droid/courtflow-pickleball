import assert from "node:assert/strict";
import { dateChips, dayHeading, filterSessions, groupByDate, listedSessions, needsSync, queryFromDate, sessionMeta, spotsLabel } from "./sessions.js";

const club = { name: "Ace Club", visibility: "public", location: "Manila" };
assert.deepEqual(sessionMeta("c1", club), { clubPublic: true, clubId: "c1", clubName: "Ace Club", clubLocation: "Manila" });
assert.equal(sessionMeta("c1", { name: "X", visibility: "private" }).clubPublic, false);
assert.equal(sessionMeta("c1", { name: "X", visibility: "private" }).clubLocation, "");

const meta = sessionMeta("c1", club);
assert.equal(needsSync({ ...meta }, meta), false);
assert.equal(needsSync({}, meta), true); // an old event with no copy
assert.equal(needsSync({ ...meta, clubPublic: false }, meta), true); // the club went public
assert.equal(needsSync({ ...meta, clubName: "Old" }, meta), true); // renamed
assert.equal(needsSync({ ...meta, clubLocation: "" }, meta), true);

assert.equal(queryFromDate(new Date("2026-10-09T03:00:00Z")), "2026-10-08");

const ev = (id, date, startTime, extra = {}) => ({ id, date, startTime, durationMins: 60, maxPlayers: 4, attendees: [], timeZone: "UTC", ...extra });
const now = new Date("2026-10-09T10:30:00Z");
const listed = listedSessions([
  ev("past", "2026-10-09", "08:00"), ev("later", "2026-10-09", "15:00"), ev("tomorrow", "2026-10-10", "09:00"),
  ev("walk", "2026-10-09", "16:00", { walkIn: true }), ev("ended", "2026-10-11", "09:00", { status: "ended" }),
  ev("live", "2026-10-09", "09:00", { status: "live" }), // started earlier but still live: listed
], now);
assert.deepEqual(listed.map((e) => e.id), ["live", "later", "tomorrow"]);
assert.equal(listedSessions([ev("tz", "2026-10-09", "09:00", { timeZone: "Asia/Manila" })], now).length, 0); // 17:30 in Manila: over

assert.equal(spotsLabel({ maxPlayers: 0, attendees: [] }), "Open");
assert.equal(spotsLabel(ev("a", "d", "t", { attendees: [{}, {}, {}, {}] })), "Full, waitlist open");
assert.equal(spotsLabel(ev("a", "d", "t", { attendees: [{}, {}, {}] })), "1 spot left");
assert.equal(spotsLabel(ev("a", "d", "t", { attendees: [{}] })), "3 spots left");

assert.deepEqual(groupByDate(listed).map((g) => [g.date, g.events.length]), [["2026-10-09", 2], ["2026-10-10", 1]]);
assert.deepEqual(dateChips(listed, "2026-10-09"), ["any", "2026-10-09", "2026-10-10"]);
assert.deepEqual(dateChips([], "2026-10-31"), ["any", "2026-10-31", "2026-11-01"]); // today and tomorrow always
const many = ["12", "13", "14", "15", "16", "17"].map((d, i) => ev(`m${i}`, `2026-10-${d}`, "09:00"));
assert.equal(dateChips(many, "2026-10-09").length, 8); // any, today, tomorrow, and at most 5 more

const named = [{ ...ev("1", "2026-10-09", "15:00", { title: "Friday mixer" }), ...meta }, { ...ev("2", "2026-10-10", "09:00", { title: "Drills", level: "Beginner" }), ...meta, clubName: "Zed", clubLocation: "Cebu" }];
assert.deepEqual(filterSessions(named, "", "any").map((e) => e.id), ["1", "2"]);
assert.deepEqual(filterSessions(named, " MIXER ", "any").map((e) => e.id), ["1"]);
assert.deepEqual(filterSessions(named, "cebu", "any").map((e) => e.id), ["2"]);
assert.deepEqual(filterSessions(named, "beginner", "any").map((e) => e.id), ["2"]);
assert.deepEqual(filterSessions(named, "", "2026-10-10").map((e) => e.id), ["2"]);
assert.equal(dayHeading("2026-10-09", "2026-10-09"), "Today");
assert.equal(dayHeading("2026-10-10", "2026-10-09"), "Tomorrow");
assert.match(dayHeading("2026-10-12", "2026-10-09"), /Oct 12/);
console.log("sessions.check: ok");
