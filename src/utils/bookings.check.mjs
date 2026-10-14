// Self-check for booking seats, totals and player-facing status. Run: node src/utils/bookings.check.mjs
import assert from "node:assert";
import { addAttendee, bookingTotals, endHM, attendeeFromRequest, hasEnded, hasEndedIn, isListed, isOver, myStatus, splitAttendees, owingIds, filterAttendees } from "./bookings.js";

const a = (id, joinedAt, paid = "unpaid", extra = {}) => ({ id, name: id, joinedAt, paid, ...extra });
const b = { date: "2026-10-11", startTime: "18:00", durationMins: 120, maxPlayers: 2, fee: 150, attendees: [] };

// Seats fill in joined order; the rest wait. A late-approved earlier request slots in by time.
b.attendees = addAttendee(addAttendee(addAttendee([], a("c", 30)), a("a", 10)), a("b", 20));
let s = splitAttendees(b);
assert.deepEqual(s.confirmed.map((x) => x.id), ["a", "b"]);
assert.deepEqual(s.waitlist.map((x) => x.id), ["c"]);

// Removing a confirmed player promotes the waitlist.
b.attendees = b.attendees.filter((x) => x.id !== "a");
assert.deepEqual(splitAttendees(b).confirmed.map((x) => x.id), ["b", "c"]);

// Totals: expected = fee × seats; collected counts paid only, custom amount wins, refunds don't count.
b.attendees = [a("a", 1, "paid"), a("b", 2, "paid", { amount: 100 }), a("c", 3, "refunded"), a("d", 4, "paid")];
const t = bookingTotals(b);
assert.equal(t.expected, 300);
assert.equal(t.collected, 150 + 100 + 150); // waitlisted "d" paid, so it's held money too
assert.equal(t.paidCount, 2);

// Times.
assert.equal(endHM(b), "20:00");
assert.equal(endHM({ startTime: "23:00", durationMins: 120 }), "01:00");
assert.ok(hasEnded(b, { date: "2026-10-12", hm: "09:00" }));
assert.ok(!hasEnded(b, { date: "2026-10-11", hm: "19:59" }));
assert.ok(hasEnded(b, { date: "2026-10-11", hm: "20:00" }));
assert.ok(!hasEnded({ ...b, startTime: "23:00" }, { date: "2026-10-11", hm: "23:59" })); // runs past midnight

// What a player sees.
b.attendees = [a("a", 1), a("b", 2, "paid"), a("c", 3)];
assert.equal(myStatus(b, "b", "approved").key, "confirmed");
assert.equal(myStatus(b, "b", "approved").paid, "paid");
assert.equal(myStatus(b, "c", "approved").label, "Waitlist #1");
assert.equal(myStatus(b, "z", "pending").key, "pending");
assert.equal(myStatus(b, "z", "declined").key, "declined");
assert.equal(myStatus(b, "z", "approved").key, "gone");
assert.equal(myStatus(undefined, "z", "pending").key, "gone");

// Review Focus 4: an event decides past/upcoming in its own zone, and a missing zone falls back.
const old = { date: "2000-01-01", startTime: "10:00", durationMins: 60, maxPlayers: 4 };
const future = { ...old, date: "2999-01-01" };
assert.equal(hasEndedIn({ ...old, timeZone: "Asia/Manila" }, "UTC"), true);
assert.equal(hasEndedIn({ ...future, timeZone: "Asia/Manila" }, "UTC"), false);
assert.equal(hasEndedIn(old, "Asia/Manila"), true); // no zone on the event: use the fallback
assert.equal(hasEndedIn({ ...future, timeZone: undefined }, "UTC"), false);

// Final review: the public attendee carries the seat id, never the secret request id or the phone number.
const reqDoc = { id: "secret-rid", seatId: "seat-9", name: "Dee", contact: "0917 555 0100", method: "online", ref: "GC1", createdAt: 1234 };
const seat = attendeeFromRequest(reqDoc);
assert.equal(seat.id, "seat-9");
assert.equal(seat.joinedAt, 1234);
assert.equal(seat.ref, undefined); // the payment reference stays on the private request
assert.ok(!JSON.stringify(seat).includes("secret-rid"));
assert.ok(!JSON.stringify(seat).includes("0917"));
assert.ok(!JSON.stringify(seat).includes("GC1"));

// Review Focus 3: ended or walk-in events never show as joinable on the public page.
assert.equal(isOver({ ...future, status: "scheduled" }, "UTC"), false);
assert.equal(isOver({ ...future, status: "ended" }, "UTC"), true); // ended early by the host
assert.equal(isOver(old, "UTC"), true);
assert.equal(isListed({ ...future, status: "scheduled" }, "UTC"), true);
assert.equal(isListed({ ...future, status: "live" }, "UTC"), true);
assert.equal(isListed({ ...future, status: "ended" }, "UTC"), false);
assert.equal(isListed({ ...future, walkIn: true }, "UTC"), false);
assert.equal(isListed(old, "UTC"), false);
// A game the host has not ended is not "past" on the host list, but the public page stops listing it once its time has passed.
assert.equal(isOver({ ...old, status: "live" }, "UTC"), false);
assert.equal(isListed({ ...old, status: "live" }, "UTC"), false);

// Event page: who still owes (confirmed seats only, not paid or refunded), and the list filter + name search.
const ev = { maxPlayers: 3, attendees: [a("p1", 1, "paid"), a("u1", 2), a("r1", 3, "refunded"), a("w1", 4)] };
assert.deepEqual(owingIds(ev), ["u1"]); // w1 is on the waitlist: not due
assert.deepEqual(owingIds({ maxPlayers: 2, attendees: [a("x", 1, "paid")] }), []);
assert.deepEqual(filterAttendees(ev.attendees, "unpaid", "").map((x) => x.id), ["u1", "w1"]);
assert.deepEqual(filterAttendees(ev.attendees, "paid", "").map((x) => x.id), ["p1"]);
assert.deepEqual(filterAttendees(ev.attendees, "refunded", "").map((x) => x.id), ["r1"]);
assert.deepEqual(filterAttendees(ev.attendees, "all", "  P1 ").map((x) => x.id), ["p1"]); // trimmed, any case
assert.deepEqual(filterAttendees(ev.attendees, "all", "").length, 4);

console.log("bookings.check: ok");
