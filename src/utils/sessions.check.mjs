import assert from "node:assert/strict";
import { dayHeading, filterSessions, groupByDate, listedSessions, metaFor, needsSync, queryFromDate, sessionMeta, spotsLabel, weekDays } from "./sessions.js";

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
  ev("live", "2026-10-09", "09:00", { status: "live", durationMins: 120 }), // live and still within its time: listed
  ev("forgotten", "2026-10-09", "07:00", { status: "live" }), // live but its time is long past: not listed (the booking page agrees)
], now);
assert.deepEqual(listed.map((e) => e.id), ["live", "later", "tomorrow"]);
assert.equal(listedSessions([ev("tz", "2026-10-09", "09:00", { timeZone: "Asia/Manila" })], now).length, 0); // 17:30 in Manila: over

// Anything malformed (events are writable by every club manager) is dropped, never thrown on
const junk = [
  { id: "n1", date: "2026-10-09" }, { id: "n2", date: 20261009, startTime: "15:00" }, { id: "n3", date: "2026-10-09", startTime: "3pm" },
  ev("n4", "2026-10-09", "15:00", { fee: "free" }), ev("n5", "2026-10-09", "15:00", { title: { a: 1 } }),
  ev("n6", "2026-10-09", "15:00", { timeZone: "Mars/Base" }), ev("n7", "2026-10-09", "15:00", { attendees: "x" }), ev("n8", "2026-10-09", "15:00", { durationMins: "9" }),
  null, "text",
];
assert.deepEqual(listedSessions([...junk, ev("ok", "2026-10-09", "15:00")], now).map((e) => e.id), ["ok"]);

// A walk-in is never public, whatever the club is
assert.equal(metaFor({ walkIn: true }, meta).clubPublic, false);
assert.equal(metaFor({}, meta).clubPublic, true);
assert.equal(needsSync({ walkIn: true, ...meta, clubPublic: false }, meta), false);
assert.equal(needsSync({ walkIn: true, ...meta }, meta), true); // a walk-in flagged public is repaired

assert.equal(spotsLabel({ maxPlayers: 0, attendees: [] }), "Open");
assert.equal(spotsLabel(ev("a", "d", "t", { attendees: [{}, {}, {}, {}] })), "Full, waitlist open");
assert.equal(spotsLabel(ev("a", "d", "t", { attendees: [{}, {}, {}] })), "1 spot left");
assert.equal(spotsLabel(ev("a", "d", "t", { attendees: [{}] })), "3 spots left");

assert.deepEqual(groupByDate(listed).map((g) => [g.date, g.events.length]), [["2026-10-09", 2], ["2026-10-10", 1]]);
// The week strip: seven days from today, weekday over date number
assert.deepEqual(weekDays("2026-10-09").map((d) => d.date), ["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]);
assert.deepEqual(weekDays("2026-10-09")[0], { date: "2026-10-09", wd: "Fri", day: 9 });
assert.deepEqual(weekDays("2026-10-30").map((d) => d.day), [30, 31, 1, 2, 3, 4, 5]); // across a month end
assert.equal(weekDays("2026-10-30")[2].date, "2026-11-01");

const named = [{ ...ev("1", "2026-10-09", "15:00", { title: "Friday mixer" }), ...meta }, { ...ev("2", "2026-10-10", "09:00", { title: "Drills", level: "Beginner" }), ...meta, clubName: "Zed", clubLocation: "Cebu" }];
assert.deepEqual(filterSessions(named, "", "any").map((e) => e.id), ["1", "2"]);
assert.deepEqual(filterSessions(named, " MIXER ", "any").map((e) => e.id), ["1"]);
assert.deepEqual(filterSessions(named, "cebu", "any").map((e) => e.id), ["2"]);
assert.deepEqual(filterSessions(named, "beginner", "any").map((e) => e.id), ["2"]);
assert.deepEqual(filterSessions(named, "", "2026-10-10").map((e) => e.id), ["2"]);
assert.equal(dayHeading("2026-10-09", "2026-10-09"), "Today, Fri, Oct 9");
assert.equal(dayHeading("2026-10-10", "2026-10-09"), "Tomorrow, Sat, Oct 10");
assert.match(dayHeading("2026-10-12", "2026-10-09"), /Oct 12/);
console.log("sessions.check: ok");
