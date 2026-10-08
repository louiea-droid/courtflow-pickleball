// Self-check for the pure game logic. Run: node src/utils/gameSession.check.mjs
import assert from "node:assert";
import {
  bookingCostEntry, buildGameSession, courtDocs, floorQuarter, gamePickList, gameStartFields,
  gameSummary, playNowEvent, playersToAdd, uidBySeat,
} from "./gameSession.js";

const att = (id, joinedAt, paid = "unpaid") => ({ id, name: id.toUpperCase(), joinedAt, paid, method: "cash" });
const event = {
  id: "e1", title: "Saturday", fee: 150, durationMins: 120, maxPlayers: 2,
  attendees: [att("a", 1, "paid"), att("b", 2), att("c", 3, "refunded")],
};

// The event names the session; account-wide settings are layered on; the club name does not leak in.
const account = { clubName: "Club", rules: { winnersStay: true }, display: { theme: "dark" }, defaults: { courts: 3 } };
const s = buildGameSession(account, { ...event, courts: 3, format: "Doubles", mode: "Balanced" });
assert.equal(s.location, "Saturday");
assert.deepEqual(s.rules, { winnersStay: true });
assert.equal(s.display.theme, "dark");
assert.equal(s.courts, 3);
assert.equal(s.clubName, undefined);
assert.equal(buildGameSession({}, {}).location, "Open play");

// A game starts from the account's session defaults; bad values fall back.
assert.deepEqual(
  gameStartFields({ defaults: { courts: 3, format: "Singles", mode: "Skill Separated" } }, 5),
  { status: "live", startedAt: 5, courts: 3, format: "Singles", mode: "Skill Separated", autoRotate: true },
);
assert.deepEqual(
  gameStartFields({}, 5),
  { status: "live", startedAt: 5, courts: 2, format: "Doubles", mode: "Balanced", autoRotate: true },
);
assert.equal(gameStartFields({ defaults: { courts: "0" } }, 1).courts, 2);
assert.equal(gameStartFields({ defaults: { mode: "Skill Courts" } }, 1).mode, "Balanced"); // a removed mode in saved defaults
assert.deepEqual(courtDocs(2, 9), [
  { id: "court-1", data: { courtNumber: 1, start: 9, teamA: [], teamB: [] } },
  { id: "court-2", data: { courtNumber: 2, start: 9, teamA: [], teamB: [] } },
]);

// The pick list: joined first, then the waitlist, each with its paid status; who is already in is flagged.
assert.deepEqual(
  gamePickList(event, [{ id: "a" }]).map((r) => [r.id, r.group, r.waitNo, r.paid, r.inGame]),
  [["a", "joined", 0, "paid", true], ["b", "joined", 0, "unpaid", false], ["c", "waitlist", 1, "refunded", false]],
);

// Review Focus 2: adding is idempotent and never touches someone already in the game.
const add = playersToAdd(event, ["a", "c", "zzz"], [{ id: "a" }], 100);
assert.deepEqual(add.map((p) => p.id), ["c"]); // a is in already; zzz is not an attendee
assert.equal(add[0].name, "C");
assert.equal(add[0].checked, false);
assert.equal(add[0].games, 0);
assert.deepEqual(playersToAdd(event, ["a"], [{ id: "a" }], 100), []);
const both = playersToAdd(event, ["c", "b"], [], 100);
assert.deepEqual(both.map((p) => p.id), ["b", "c"]); // joined order, not tick order
assert.ok(both[0].createdAt < both[1].createdAt);

// The active queue: a booker who was signed in brings their uid onto the player, nobody else gets one.
const linked = playersToAdd(event, ["b", "c"], [], 100, { b: "u-b" });
assert.equal(linked[0].uid, "u-b");
assert.equal("uid" in linked[1], false);
assert.equal("uid" in playersToAdd(event, ["b"], [], 100)[0], false);
assert.deepEqual(uidBySeat([{ seatId: "s1", uid: "u1" }, { seatId: "s2" }, { seatId: "s3", uid: 7 }, { uid: "u9" }]), { s1: "u1" });
assert.deepEqual(uidBySeat(undefined), {});

// Review Focus 2: booking payment status follows the event attendee record.
const c1 = bookingCostEntry(event, new Set(["a", "b"]), null, 50);
assert.equal(c1.total, 300);
assert.equal(c1.perPerson, 150);
assert.equal(c1.hours, 2);
assert.equal(c1.rate, 150);
assert.deepEqual(c1.playerIds, ["a", "b"]);
assert.deepEqual(c1.paid, { a: true, b: false });
assert.equal(c1.bookingId, "e1");
assert.equal(c1.label, "Saturday");
assert.equal(c1.createdAt, 50);
assert.equal(c1.visibleOnLive, false);
const c2 = bookingCostEntry(event, new Set(["a", "b", "c"]), { paid: { a: false, b: true }, visibleOnLive: true, createdAt: 10 }, 99);
assert.deepEqual(c2.paid, { a: true, b: false, c: false }); // attendee statuses override the cached booking map
assert.equal(c2.visibleOnLive, true);
assert.equal(c2.createdAt, 10);
assert.equal(c2.total, 450);
assert.equal(bookingCostEntry({ ...event, fee: 0 }, new Set(["a"]), null, 1), null);
assert.equal(bookingCostEntry(event, new Set(), null, 1), null);
// Someone already charged stays on the entry even if they left the game.
const c3 = bookingCostEntry(event, new Set(["b"]), { paid: { a: true, b: false }, playerIds: ["a", "b"], createdAt: 10 }, 99);
assert.deepEqual(c3.playerIds, ["a", "b"]);
assert.deepEqual(c3.paid, { a: true, b: false });
assert.equal(c3.total, 300);

// Play now: today, the current quarter hour, no seats, a live game.
assert.equal(floorQuarter("17:52"), "17:45");
assert.equal(floorQuarter("00:05"), "00:00");
assert.equal(floorQuarter("09:15"), "09:15");
assert.equal(floorQuarter("23:59"), "23:45");
const pn = playNowEvent({ account: { defaults: { courts: 3 } }, today: "2026-10-08", hm: "17:52", timeZone: "Asia/Manila", hostName: "Club", now: 7 });
assert.equal(pn.title, "Play now");
assert.equal(pn.date, "2026-10-08");
assert.equal(pn.startTime, "17:45");
assert.equal(pn.durationMins, 240);
assert.equal(pn.walkIn, true);
assert.equal(pn.status, "live");
assert.equal(pn.courts, 3);
assert.equal(pn.startedAt, 7);
assert.equal(pn.maxPlayers, 0);
assert.equal(pn.fee, 0);
assert.deepEqual(pn.attendees, []);
assert.equal(pn.timeZone, "Asia/Manila");
assert.equal(pn.hostName, "Club");

// The event page's game line.
assert.deepEqual(gameSummary([{ checked: true, games: 3 }, { checked: false, games: 1 }, { checked: true, games: 0 }], "Doubles"), { players: 3, checkedIn: 2, matches: 1 });
assert.deepEqual(gameSummary([], "Doubles"), { players: 0, checkedIn: 0, matches: 0 });

console.log("gameSession.check: ok");
