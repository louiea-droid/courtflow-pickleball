// Self-check for the account's bookings. Run: node src/utils/myBookings.check.mjs
import assert from "node:assert/strict";
import { bookingCopy, bookingRows, minutesUntil, recentCopies } from "./myBookings.js";
import { buildNotifications } from "./notifications.js";

const at = new Date("2026-11-12T09:30:00Z"); // 17:30 in Manila
const ev = (id, extra = {}) => ({ id, title: `Game ${id}`, date: "2026-11-12", startTime: "18:00", durationMins: 120, timeZone: "Asia/Manila", maxPlayers: 2, attendees: [], ...extra });

// The copy: ids and what sorts it, never the live details' only source.
assert.deepEqual(bookingCopy({ clubId: "pub", clubName: "Pub", event: ev("e1"), seatId: "s1", at: 5 }),
  { clubId: "pub", eventId: "e1", seatId: "s1", clubName: "Pub", title: "Game e1", date: "2026-11-12", startTime: "18:00", bookedAt: 5 });

// Only from yesterday on, soonest first, at most `max`.
const copies = [{ id: "old", date: "2026-11-01", startTime: "10:00" }, { id: "b", date: "2026-11-13", startTime: "08:00" }, { id: "a", date: "2026-11-11", startTime: "20:00" }];
assert.deepEqual(recentCopies(copies, "2026-11-12").map((c) => c.id), ["a", "b"]);
assert.deepEqual(recentCopies(copies, "2026-11-12", 1).map((c) => c.id), ["a"]);

// Minutes on the event's own clock.
assert.equal(minutesUntil(ev("e1"), at), 30);
assert.equal(minutesUntil(ev("e1", { date: "2026-11-13" }), at), null);

const row = (id, event, req) => ({ id, clubId: "pub", eventId: event?.id || id, seatId: `s-${id}`, clubName: "Pub", date: "2026-11-12", startTime: "18:00" });
const events = {
  r1: ev("e1", { attendees: [{ id: "s-r1", name: "A" }] }), // confirmed, starts in 30 min
  r2: ev("e2", { startTime: "20:00", attendees: [{ id: "x" }, { id: "y" }, { id: "s-r2" }] }), // waitlist #1
  r3: ev("e3", { startTime: "21:00" }), // pending
  r4: ev("e4", { startTime: "21:00" }), // declined
  r5: ev("e5", { startTime: "08:00" }), // ended this morning: dropped
  r6: ev("e6", { status: "ended" }), // ended by the host: dropped
};
const reqs = { r1: { status: "approved" }, r2: { status: "approved" }, r3: { status: "pending" }, r4: { status: "declined" }, r5: null, r6: null, r7: null };
const rows = bookingRows(["r1", "r2", "r3", "r4", "r5", "r6", "r7"].map((id) => row(id, events[id])), events, reqs, at);
assert.deepEqual(rows.map((r) => [r.id, r.status.key, r.soon]),
  [["r1", "confirmed", true], ["r2", "waitlist", false], ["r3", "pending", false], ["r4", "declined", false]]);
assert.equal(rows[0].to, "/open-play?club=pub&event=e1");
// A deleted request with no seat reads as removed by the host.
assert.equal(bookingRows([row("r3", events.r3)], events, { r3: "gone" }, at)[0].status.label, "Removed from the list by the host");

// The bell: starting soon, declined; the waitlist and pending give no line; a confirmed one not yet soon says "You're in".
const items = buildNotifications({ uid: "me", bookings: rows });
assert.deepEqual(items.map((i) => i.title), ["Starting soon: Game e1", "Not accepted: Game e4"]);
assert.equal(items[0].kind, "booking");
const later = bookingRows([row("r1", events.r1)], events, reqs, new Date("2026-11-12T08:00:00Z")); // 16:00, two hours before
assert.deepEqual(buildNotifications({ uid: "me", bookings: later }).map((i) => [i.title, i.key]), [["You're in: Game e1", "booking:pub/r1:in"]]);
// Bookings come right after turn alerts.
const mixed = buildNotifications({ uid: "me", bookings: rows, joinRequests: [{ id: "u", clubId: "pub", clubName: "Pub", name: "Dee", createdAt: 1 }] });
assert.deepEqual(mixed.map((i) => i.kind), ["booking", "booking", "join"]);

console.log("myBookings.check: ok");
