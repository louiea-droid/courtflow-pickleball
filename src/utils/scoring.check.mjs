// Self-check for the umpire score. Run: node src/utils/scoring.check.mjs
import assert from "node:assert";
import { adjust, call, finalText, firstServe, gamePoint, liveScore, newScore, rally, undo, winner } from "./scoring.js";

const play = (s, ...teams) => teams.reduce(rally, s);

// Side-out doubles starts 0-0-2, team 1 serving.
let s = newScore({ start: 100 });
assert.equal(call(s), "0 - 0 - 2");
assert.equal(call(rally(s, 1)), "1 - 0 - 2"); // serving team wins: point, same server
// Receiving team wins at server 2: side out, team 2 serves as server 1.
s = rally(s, 2);
assert.deepEqual([s.t1, s.t2, s.serving, s.server], [0, 0, 2, 1]);
assert.equal(call(s), "0 - 0 - 1");
// Team 2 scores twice, loses a rally at server 1 (-> server 2), then at server 2 (-> side out to team 1).
s = play(s, 2, 2);
assert.equal(call(s), "2 - 0 - 1");
s = rally(s, 1);
assert.deepEqual([s.serving, s.server], [2, 2]);
s = rally(s, 1);
assert.deepEqual([s.serving, s.server], [1, 1]);
assert.equal(call(s), "0 - 2 - 1"); // serving team's score first

// Undo steps back one rally; nothing to undo is a no-op.
assert.equal(call(undo(s)), "2 - 0 - 2");
assert.equal(undo(newScore({ start: 1 })).t1, 0);
const back = undo(rally(newScore({ start: 1 }), 1));
assert.equal(call(back), "0 - 0 - 2");

// Rally scoring: the rally winner scores, no server number.
let r = newScore({ start: 1, style: "rally" });
r = play(r, 2, 2, 1);
assert.equal(call(r), "1 - 2");
assert.equal(r.server, null);

// Singles side-out: no server number; the receiver winning only takes the serve.
let g = newScore({ start: 1, singles: true });
assert.equal(call(g), "0 - 0");
g = rally(g, 2);
assert.deepEqual([g.t1, g.t2, g.serving], [0, 0, 2]);
g = rally(g, 2);
assert.equal(g.t2, 1);

// First serve can be switched only before the first rally.
assert.equal(firstServe(newScore({ start: 1 }), 2).serving, 2);
assert.equal(firstServe(rally(newScore({ start: 1 }), 1), 2).serving, 1);

// Win by 2 (play to 11): 11-10 is not over, 12-10 is; 10-10 is not.
const at = (t1, t2, extra = {}) => ({ ...newScore({ start: 1, style: "rally" }), t1, t2, ...extra });
assert.equal(winner(at(11, 9)), 1);
assert.equal(winner(at(11, 10)), 0);
assert.equal(winner(at(12, 10)), 1);
assert.equal(winner(at(10, 12)), 2);
assert.equal(winner(at(10, 10)), 0);
assert.equal(winner(at(10, 5, { to: 15 })), 0);
// No more rallies after the game is over.
const done = at(11, 3);
assert.equal(rally(done, 2), done);
// Game point: side-out, only the serving team can score.
const sd = { ...newScore({ start: 1 }), t1: 10, t2: 5, serving: 1 };
assert.equal(gamePoint(sd), 1);
assert.equal(gamePoint({ ...sd, serving: 2 }), 0);
assert.equal(gamePoint({ ...sd, t2: 10 }), 0); // 11-10 would not win
assert.equal(gamePoint({ ...sd, t1: 9, t2: 10, serving: 2 }), 2);
assert.equal(gamePoint(at(10, 5)), 1); // rally scoring: either team
assert.equal(finalText(at(7, 11)), "11-7");

// Adjust never goes below 0 and can be undone; the log is capped at 50.
assert.equal(adjust(newScore({ start: 1 }), 1, -1).t1, 0);
assert.equal(adjust(newScore({ start: 1 }), 2, 1).t2, 1);
assert.equal(undo(adjust(newScore({ start: 1 }), 2, 1)).t2, 0);
let long = newScore({ start: 1, style: "rally", to: 99 });
for (let i = 0; i < 80; i++) long = rally(long, 1);
assert.equal(long.log.length, 50);

// A score left over from an earlier match (different start) reads as a fresh 0-0.
const court = { start: 200, teamA: ["a", "b"], teamB: ["c", "d"], score: { ...newScore({ start: 100 }), t1: 9 } };
assert.equal(liveScore(court, { style: "sideout", to: 11 }).t1, 0);
assert.equal(liveScore({ ...court, score: { ...court.score, start: 200 } }, {}).t1, 9);
assert.equal(liveScore({ ...court, score: undefined }, { singles: true }).singles, true);

console.log("scoring checks passed");
