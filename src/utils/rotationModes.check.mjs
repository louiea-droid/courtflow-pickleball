// Self-check for Balanced team splitting. Run: node src/utils/rotationModes.check.mjs
import assert from "node:assert";
import {
  hasGender, lockProblem, mixedLockProblems, mixedSideFor, mixedTeamAccepts, selectForCourt, selectToJoin, shouldWinnersStay, splitTeams, validLock,
} from "./rotationModes.js";
import { normalizeMode } from "../data/constants.js";

const p = (id, skill, extra = {}) => ({ id, skill, ...extra });
const stars = (team, group) => team.reduce((s, id) => s + (group.find((x) => x.id === id).skill || 0), 0);
const sameTeam = ([a, b], x, y) => (a.includes(x) && a.includes(y)) || (b.includes(x) && b.includes(y));

// 3,3,2,2 → each team gets one 3★ and one 2★.
let g = [p("a", 3), p("b", 3), p("c", 2), p("d", 2)];
let t = splitTeams(g, "Balanced");
assert.equal(stars(t[0], g), 5); assert.equal(stars(t[1], g), 5);

// 5,5,1,1 → 6 vs 6.
g = [p("a", 5), p("b", 5), p("c", 1), p("d", 1)];
t = splitTeams(g, "Balanced");
assert.equal(stars(t[0], g), 6);

// 4,3,2,1 → strongest + weakest vs the middle two.
g = [p("a", 4), p("b", 3), p("c", 2), p("d", 1)];
t = splitTeams(g, "Balanced");
assert.ok(sameTeam(t, "a", "d") && sameTeam(t, "b", "c"));

// 3,3,3,2: every split is 6 vs 5, so repeat partners decide — "d" just partnered "a".
g = [p("a", 3, { partners: ["d"] }), p("b", 3), p("c", 3), p("d", 2, { partners: ["a"] })];
t = splitTeams(g, "Balanced");
assert.ok(!sameTeam(t, "a", "d"));

// Unrated counts as the average of the rated ones: 4,4,2,? (avg 3.33) → 4+2 vs 4+?.
g = [p("a", 4), p("b", 4), p("c", 2), p("d", undefined)];
t = splitTeams(g, "Balanced");
assert.ok(sameTeam(t, "a", "c") || sameTeam(t, "b", "c"));
assert.ok(!sameTeam(t, "a", "b"));

// Locked partners still stay together even if that's less balanced.
g = [p("a", 3, { lockedWithId: "b" }), p("b", 3, { lockedWithId: "a" }), p("c", 2), p("d", 2)];
t = splitTeams(g, "Balanced");
assert.ok(sameTeam(t, "a", "b"));

// Other modes ignore stars.
g = [p("a", 3), p("b", 3), p("c", 2), p("d", 2)];
assert.deepEqual(splitTeams(g, "Skill Separated"), [["a", "b"], ["c", "d"]]);

// ---- Skill Separated: grouping and joining
const ids = (r) => r.taken.map((x) => x.id).join(",");
const court = { id: "court-1" };

// The group is the first full tier in queue order, so a short tier at the front doesn't block the court.
let pool = [p("b1", 1), p("i1", 3), p("i2", 3), p("i3", 3), p("i4", 3)];
let pick = selectForCourt({ pool, court, mode: "Skill Separated", need: 4 });
assert.equal(ids(pick), "i1,i2,i3,i4");
assert.deepEqual(pick.remaining.map((x) => x.id), ["b1"]); // the beginner keeps their place

// Earlier full tier wins over a later full tier.
pool = [p("a1", 3), p("e1", 5), p("a2", 3), p("e2", 5), p("a3", 3), p("e3", 5), p("a4", 3), p("e4", 5)];
assert.equal(ids(selectForCourt({ pool, court, mode: "Skill Separated", need: 4 })), "a1,a2,a3,a4");

// No tier has four but five wait: the front player plus the three closest in skill play.
pool = [p("a1", 3), p("a2", 3), p("e1", 5), p("e2", 5), p("b1", 1)];
assert.equal(ids(selectForCourt({ pool, court, mode: "Skill Separated", need: 4 })), "a1,a2,e1,e2");
// Fewer players than seats: still waits.
assert.equal(ids(selectForCourt({ pool: pool.slice(0, 3), court, mode: "Skill Separated", need: 4 })), "");
// Winners / Losers with mixed results (no group of four): queue order, never a stalled court.
pool = [p("n1", 3), p("w1", 3, { lastResult: "win" }), p("l1", 3, { lastResult: "loss" }), p("w2", 3, { lastResult: "win" }), p("l2", 3, { lastResult: "loss" })];
assert.equal(ids(selectForCourt({ pool, court, mode: "Winners / Losers", need: 4 })), "n1,w1,l1,w2");

// Singles: first tier with two.
pool = [p("b1", 1), p("a1", 2), p("a2", 2)];
assert.equal(ids(selectForCourt({ pool, court, mode: "Skill Separated", need: 2 })), "a1,a2");

// Winners / Losers shares the grouping and the fix.
pool = [p("n1", 1, { lastResult: "loss" }), p("w1", 1, { lastResult: "win" }), p("w2", 1, { lastResult: "win" }), p("w3", 1, { lastResult: "win" }), p("w4", 1, { lastResult: "win" })];
assert.equal(ids(selectForCourt({ pool, court, mode: "Winners / Losers", need: 4 })), "w1,w2,w3,w4");

// Joining a court that already has players (winners stay on, or topping up an open seat) keeps the winners' tier.
const seated = [p("s1", 5), p("s2", 5)];
pool = [p("b1", 1), p("b2", 1), p("e1", 5), p("e2", 5)];
assert.equal(ids(selectToJoin({ pool, court, seated, mode: "Skill Separated", need: 2 })), "e1,e2");
// None of their tier waiting: nobody joins yet (the seated players wait for a match).
assert.equal(ids(selectToJoin({ pool: [p("b1", 1), p("b2", 1)], court, seated, mode: "Skill Separated", need: 2 })), "");
// Any other mode: next in the queue, as before.
assert.equal(ids(selectToJoin({ pool, court, seated, mode: "Balanced", need: 2 })), "b1,b2");
// An explicit court level still decides.
assert.equal(ids(selectToJoin({ pool, court: { level: "Beginner" }, seated, mode: "Skill Separated", need: 2 })), "b1,b2");
// Nobody seated yet: falls back to the normal pick.
assert.equal(ids(selectToJoin({ pool, court, seated: [], mode: "Skill Separated", need: 2 })), "b1,b2");

// ---- Mixed Doubles: challengers for a winning team keep every team one M + one F
const mx = (id, gender) => p(id, 3, { gender });
pool = [mx("m1", "M"), mx("m2", "M"), mx("f1", "F")];
assert.equal(ids(selectToJoin({ pool, court, seated: [mx("w1", "M"), mx("w2", "F")], mode: "Mixed Doubles", need: 2 })), "m1,f1");
// Not enough of one gender waiting: nobody joins yet.
assert.equal(ids(selectToJoin({ pool: [mx("m1", "M"), mx("m2", "M")], court, seated: [mx("w1", "M"), mx("w2", "F")], mode: "Mixed Doubles", need: 2 })), "");
// Seated pair of the same gender (a locked duo): the other team takes the other gender.
assert.equal(ids(selectToJoin({ pool: [mx("m1", "M"), mx("f1", "F"), mx("f2", "F")], court, seated: [mx("w1", "M"), mx("w2", "M")], mode: "Mixed Doubles", need: 2 })), "f1,f2");
// Players with no gender set: normal next-in-queue pick.
assert.equal(ids(selectToJoin({ pool: [mx("m1", "M"), mx("m2", "M")], court, seated: [p("w1", 3), p("w2", 3)], mode: "Mixed Doubles", need: 2 })), "m1,m2");
// The rest are unchanged: another mode takes the front of the queue.
assert.equal(ids(selectToJoin({ pool, court, seated: [mx("w1", "M"), mx("w2", "F")], mode: "Balanced", need: 2 })), "m1,m2");

// ---- Mixed Doubles: teams are always one man and one woman
const x = (id, gender, extra = {}) => p(id, 3, { gender, ...extra });
assert.equal(validLock(x("a", "M"), x("b", "F"), "Mixed Doubles"), true);
assert.equal(validLock(x("a", "M"), x("b", "M"), "Mixed Doubles"), false);
assert.equal(validLock(x("a", "F"), x("b", "F"), "Mixed Doubles"), false);
assert.equal(validLock(x("a", "M"), p("b", 3), "Mixed Doubles"), false); // no gender set
assert.equal(validLock(x("a", "M"), x("b", "M"), "Balanced"), true); // only Mixed Doubles cares

// A same-gender lock saved earlier is ignored in Mixed Doubles: the picks and the teams stay M + F.
pool = [x("m1", "M", { lockedWithId: "m2" }), x("m2", "M", { lockedWithId: "m1" }), x("f1", "F"), x("f2", "F")];
pick = selectForCourt({ pool, court, mode: "Mixed Doubles", need: 4 });
assert.deepEqual(splitTeams(pick.taken, "Mixed Doubles"), [["m1", "f1"], ["m2", "f2"]]);
// A valid man-woman lock is still honored.
pool = [x("m1", "M", { lockedWithId: "f2" }), x("f1", "F"), x("m2", "M"), x("f2", "F", { lockedWithId: "m1" })];
pick = selectForCourt({ pool, court, mode: "Mixed Doubles", need: 4 });
assert.deepEqual(splitTeams(pick.taken, "Mixed Doubles").map((t) => t.slice().sort().join("+")), ["f2+m1", "f1+m2"]);

// The warning shown when a lock is refused.
assert.equal(lockProblem(x("a", "M"), x("b", "F"), "Mixed Doubles"), null);
assert.equal(lockProblem(x("a", "M"), x("b", "M"), "Balanced"), null);
assert.match(lockProblem({ ...x("a", "M"), name: "Al" }, { ...x("b", "M"), name: "Bo" }, "Mixed Doubles"), /one man and one woman.*Al and Bo/);
assert.match(lockProblem({ ...p("a", 3), name: "Al" }, x("b", "F"), "Mixed Doubles"), /Al has no gender set/);
assert.match(lockProblem(x("a", "M"), { ...p("b", 3), name: "Bo" }, "Mixed Doubles"), /Bo has no gender set/);
assert.equal(hasGender(x("a", "F")), true);
assert.equal(hasGender(p("a", 3)), false);

// Which saved locks break the rule (so the host can be told).
const lockPlayers = [
  x("a", "M", { lockedWithId: "b" }), x("b", "M", { lockedWithId: "a" }), // two men
  x("c", "M", { lockedWithId: "d" }), x("d", "F", { lockedWithId: "c" }), // fine
  p("e", 3, { lockedWithId: "f" }), x("f", "F", { lockedWithId: "e" }),   // no gender
];
assert.deepEqual(mixedLockProblems(lockPlayers).map((q) => q.join("-")), ["a-b", "e-f"]);

// Manual moves: can this player join this team?
assert.equal(mixedTeamAccepts(x("w", "F"), [x("m", "M")]).ok, true);
assert.equal(mixedTeamAccepts(x("w", "F"), []).ok, true);
assert.match(mixedTeamAccepts(x("m2", "M"), [x("m", "M")]).reason, /two men/);
assert.match(mixedTeamAccepts(x("w2", "F"), [x("w", "F")]).reason, /two women/);
assert.match(mixedTeamAccepts(p("n", 3), []).reason, /no gender/);
// Which side of a court takes a called player.
assert.equal(mixedSideFor(x("m", "M"), [], []), "A");
assert.equal(mixedSideFor(x("m", "M"), [x("a", "M")], []), "B");
assert.equal(mixedSideFor(x("m", "M"), [x("a", "M"), x("b", "F")], [x("c", "F")]), "B");
assert.equal(mixedSideFor(x("m", "M"), [x("a", "M"), x("b", "F")], [x("c", "M")]), null);
assert.equal(mixedSideFor(p("n", 3), [], []), null);

// Topping up a half-filled court brings the missing genders (men first, then women).
assert.equal(ids(selectToJoin({ pool: [x("m1", "M"), x("f1", "F")], court, seated: [x("a", "M"), x("b", "F"), x("c", "M")], mode: "Mixed Doubles", need: 1 })), "f1");
assert.equal(ids(selectToJoin({ pool: [x("m1", "M"), x("m2", "M"), x("f1", "F"), x("f2", "F")], court, seated: [x("a", "M")], mode: "Mixed Doubles", need: 3 })), "m1,f1,f2");

// ---- Winners / Losers: winners stay on, challengers are recent winners first
pool = [p("l1", 3, { lastResult: "loss" }), p("w1", 3, { lastResult: "win" }), p("l2", 3, { lastResult: "loss" }), p("w2", 3, { lastResult: "win" })];
assert.equal(ids(selectToJoin({ pool, court, seated: [p("s1", 3), p("s2", 3)], mode: "Winners / Losers", need: 2 })), "w1,w2");
assert.equal(ids(selectToJoin({ pool: pool.slice(0, 3), court, seated: [p("s1", 3), p("s2", 3)], mode: "Winners / Losers", need: 2 })), "w1,l1");
assert.equal(ids(selectToJoin({ pool: pool.slice(0, 1), court, seated: [p("s1", 3), p("s2", 3)], mode: "Winners / Losers", need: 2 })), "");
// The win limit: winners stay until they have won that many in a row, in this mode even if the club setting is off.
const rules = { winnersStay: false, maxWinStreak: 2 };
assert.equal(shouldWinnersStay({ rules, mode: "Winners / Losers", streak: 1, winners: ["a", "b"] }), true);
assert.equal(shouldWinnersStay({ rules, mode: "Winners / Losers", streak: 2, winners: ["a", "b"] }), false); // second win: they rest
assert.equal(shouldWinnersStay({ rules: { ...rules, maxWinStreak: 3 }, mode: "Winners / Losers", streak: 2, winners: ["a", "b"] }), true);
assert.equal(shouldWinnersStay({ rules, mode: "Balanced", streak: 1, winners: ["a", "b"] }), false); // other modes follow the club setting
assert.equal(shouldWinnersStay({ rules: { winnersStay: true, maxWinStreak: 2 }, mode: "Balanced", streak: 1, winners: ["a", "b"] }), true);
assert.equal(shouldWinnersStay({ rules, mode: "Winners / Losers", streak: 1, winners: [] }), false);

// ---- Custom: nothing is picked automatically
pool = [p("a", 3), p("b", 3), p("c", 3), p("d", 3)];
assert.equal(ids(selectForCourt({ pool, court, mode: "Custom", need: 4 })), "");
assert.equal(ids(selectToJoin({ pool, court, seated: [p("s", 3)], mode: "Custom", need: 1 })), "");
// Skill Courts is gone: saved sessions move to Balanced.
assert.equal(normalizeMode("Skill Courts"), "Balanced");
assert.equal(normalizeMode("Mixed Doubles"), "Mixed Doubles");
assert.equal(normalizeMode(undefined), undefined);

console.log("rotationModes checks passed");
