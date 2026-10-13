// Run: node src/utils/queueStatus.check.mjs
import assert from "node:assert/strict";
import { DEFAULT_GAME_MINUTES, queueOrder, queueStatus } from "./queueStatus.js";

const P = (id, o = {}) => ({ id, checked: true, games: 0, checkedAt: 1, ...o });
const court = (n, a = [], b = []) => ({ id: `court-${n}`, courtNumber: n, teamA: a, teamB: b });

// order: fewest games first, then earliest check-in, then id; not-checked-in and on-court players are out
const players = [P("a", { games: 2 }), P("b", { games: 0, checkedAt: 5 }), P("c", { games: 0, checkedAt: 3 }), P("d", { checked: false }), P("e")];
const courts = [court(1, ["e"], [])];
assert.deepEqual(queueOrder(players, courts).map((p) => p.id), ["c", "b", "a"]);

// not in the game, not checked in, nobody
assert.equal(queueStatus({ players, courts, uid: "x", format: "Doubles" }), null);
assert.equal(queueStatus({ players: [P("d", { uid: "u", checked: false })], courts, uid: "u", format: "Doubles" }), null);
assert.equal(queueStatus({ players: [], courts: [], uid: "u", format: "Doubles" }), null);
assert.equal(queueStatus({ players: [P("z", { uid: "u" })], courts: [], uid: "", format: "Doubles" }), null);

// on a court
assert.deepEqual(queueStatus({ players: [P("e", { uid: "u" })], courts: [court(2, ["e"])], uid: "u", format: "Doubles" }), { state: "playing", court: 2 });

// waiting, both courts busy: 2 courts x 4 seats = 8 per round; position 4 -> round 1 -> (1 - 0.5) x 15 = 7.5 -> 10
const busy = [court(1, ["p1", "p2"], ["p3", "p4"]), court(2, ["p5", "p6"], ["p7", "p8"])];
const q = ["w1", "w2", "w3"].map((id, i) => P(id, { checkedAt: i }));
const me = P("me", { uid: "u", checkedAt: 9 });
assert.deepEqual(queueStatus({ players: [...q, me], courts: busy, uid: "u", format: "Doubles", gameMinutes: 15 }),
  { state: "waiting", position: 4, ahead: 3, waitMins: 10, upNext: false, nextOn: null });
// position 9 -> round 2 -> 1.5 x 15 = 22.5 -> 25 (rounded to 5)
const many = Array.from({ length: 8 }, (_, i) => P(`m${i}`, { checkedAt: i }));
assert.equal(queueStatus({ players: [...many, me], courts: busy, uid: "u", format: "Doubles", gameMinutes: 15 }).waitMins, 25);
// singles: 2 seats per court, 4 per round; position 3 -> round 1 -> 0.5 x 20 = 10
const s = queueStatus({ players: [P("s1"), P("s2"), me], courts: busy, uid: "u", format: "Singles", gameMinutes: 20 });
assert.deepEqual([s.position, s.waitMins], [3, 10]);
// singles, position 5 -> round 2 -> 1.5 x 20 = 30
const s5 = queueStatus({ players: [P("s1"), P("s2"), P("s3"), P("s4"), me], courts: busy, uid: "u", format: "Singles", gameMinutes: 20 });
assert.deepEqual([s5.position, s5.waitMins], [5, 30]);
// a free court: the first seats on it are up next, wait 0
const oneFree = [court(1, ["p1", "p2"], ["p3", "p4"]), court(2)];
assert.deepEqual(queueStatus({ players: [P("w1"), me], courts: oneFree, uid: "u", format: "Doubles" }),
  { state: "waiting", position: 2, ahead: 1, waitMins: 0, upNext: true, nextOn: null });
// beyond the free court's seats the person waits for the next round
const six = ["w1", "w2", "w3", "w4"].map((id, i) => P(id, { checkedAt: i }));
const beyond = queueStatus({ players: [...six, me], courts: oneFree, uid: "u", format: "Doubles", gameMinutes: 15 });
assert.deepEqual([beyond.position, beyond.upNext, beyond.waitMins], [5, false, 10]); // one more round: 0.5 x 15 -> 10
// the default game length, ties broken by id, and no courts at all (nothing to wait for: up next)
assert.equal(DEFAULT_GAME_MINUTES, 15);
const tieA = P("a1", { uid: "u" }), tieB = P("b1");
assert.equal(queueStatus({ players: [tieB, tieA], courts: busy, uid: "u", format: "Doubles" }).position, 1);
assert.equal(queueStatus({ players: [me], courts: [], uid: "u", format: "Doubles" }).upNext, true);
// Older player docs may lack games or checkedAt: they count as 0, so the order is still stable
const legacy = [{ id: "z", checked: true }, { id: "y", checked: true, games: 1 }, { id: "x", checked: true, games: 0, checkedAt: 5 }];
assert.deepEqual(queueOrder(legacy, []).map((p) => p.id), ["z", "x", "y"]);
// with a mode the next match is the queue app's own pick (upNextByCourt)
const playing4 = [court(1, ["x1", "x2"], ["x3", "x4"])];
const line = (meAt) => Array.from({ length: 6 }, (_, i) => i === meAt ? P("me", { uid: "u", checkedAt: i }) : P(`w${i}`, { checkedAt: i }));
let m = queueStatus({ players: line(2), courts: playing4, uid: "u", format: "Doubles", mode: "Balanced", gameMinutes: 15 });
assert.deepEqual([m.nextOn, m.upNext, m.waitMins], [1, false, 10]); // picked for court 1's next match
m = queueStatus({ players: line(5), courts: playing4, uid: "u", format: "Doubles", mode: "Balanced", gameMinutes: 15 });
assert.deepEqual([m.position, m.nextOn, m.waitMins], [6, null, 25]); // not picked: one round after the picks
m = queueStatus({ players: line(1), courts: [court(1)], uid: "u", format: "Doubles", mode: "Balanced" });
assert.deepEqual([m.upNext, m.nextOn, m.waitMins], [true, 1, 0]); // picked for an open court
m = queueStatus({ players: line(1).slice(0, 3), courts: playing4, uid: "u", format: "Doubles", mode: "Balanced", gameMinutes: 15 });
assert.deepEqual([m.nextOn, m.waitMins], [null, 10]); // too few for a match: they go on when the court frees up
m = queueStatus({ players: line(2), courts: playing4, uid: "u", format: "Doubles", mode: "Custom", gameMinutes: 15 });
assert.deepEqual([m.nextOn, m.waitMins], [null, 10]); // Custom: plain queue order
console.log("queueStatus.check: ok");
