// Self-check for Balanced team splitting. Run: node src/utils/rotationModes.check.mjs
import assert from "node:assert";
import {
  hasGender, lockProblem, mixedLockProblems, mixedSideFor, mixedTeamAccepts, selectForCourt, ignoredLocks, seatJoiners, selectToJoin, trimHistory, shouldWinnersStay, STARVE_MS, splitTeams, validLock,
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

// ---- Queue fixes (see scripts/queue-demo.mjs)
const NOW = 10 * STARVE_MS;
const at = (id, skill, minsAgo, extra = {}) => p(id, skill, { checkedAt: NOW - minsAgo * 60000, ...extra });
// A lone Expert who waited past STARVE_MS plays with the closest levels; a fresh arrival still waits.
pool = [at("x", 6, 20), at("i1", 3, 19), at("i2", 3, 18), at("i3", 3, 17), at("i4", 3, 16), at("a1", 5, 15), at("a2", 5, 14)];
assert.equal(ids(selectForCourt({ pool, court, mode: "Skill Separated", need: 4, now: NOW })), "x,i1,a1,a2".split(",").sort((m, n) => pool.findIndex((q) => q.id === m) - pool.findIndex((q) => q.id === n)).join(","));
pool[0] = at("x", 6, 2);
assert.equal(ids(selectForCourt({ pool, court, mode: "Skill Separated", need: 4, now: NOW })), "i1,i2,i3,i4");
assert.equal(ids(selectForCourt({ pool, court, mode: "Skill Separated", need: 4 })), "i1,i2,i3,i4"); // no clock: unchanged

// A lock across skill levels is ignored in Skill Separated (one level per match); same level still pulls the partner in.
pool = [p("a", 3, { lockedWithId: "z" }), p("b", 3), p("c", 3), p("d", 3), p("z", 5, { lockedWithId: "a" }), p("y", 5)];
assert.equal(ids(selectForCourt({ pool, court, mode: "Skill Separated", need: 4 })), "a,b,c,d");
pool = [p("a", 3, { lockedWithId: "z" }), p("b", 3), p("c", 3), p("d", 3), p("z", 3, { lockedWithId: "a" })];
pick = selectForCourt({ pool, court, mode: "Skill Separated", need: 4 });
assert.equal(ids(pick), "a,b,c,z");
assert.deepEqual(pick.remaining.map((x) => x.id), ["d"]); // the bumped player stays first in line

// Challengers / top-ups bring a locked partner with them, and a seated player's waiting partner.
pool = [p("l", 3, { lockedWithId: "m" }), p("n", 3), p("o", 3), p("m", 3, { lockedWithId: "l" })];
assert.equal(ids(selectToJoin({ pool, court, seated: [p("w1", 3), p("w2", 3)], mode: "Balanced", need: 2 })), "l,m");
pool = [p("pat", 3), p("dee", 3, { lockedWithId: "alan" }), p("q", 3), p("r", 3)];
const alan = p("alan", 3, { lockedWithId: "dee" });
assert.ok(ids(selectToJoin({ pool, court, seated: [alan], mode: "Balanced", need: 3 })).includes("dee"));
// ...unless the seated side is fixed (winners staying on): their partner is not pulled over to the other team.
assert.equal(ids(selectToJoin({ pool: [p("dee", 3, { lockedWithId: "alan" }), p("q", 3)], court, seated: [alan, p("w", 3)], mode: "Balanced", need: 2, pullSeatedPartners: false })), "dee,q");

// Topping up: with a list, only those seated players pull their waiting partner in
pool = [p("q1", 3), p("q2", 3), p("q3", 3), p("dee", 3, { lockedWithId: "alan" })];
assert.ok(ids(selectToJoin({ pool, court, seated: [alan], mode: "Balanced", need: 3 })).includes("dee"));
assert.ok(!ids(selectToJoin({ pool, court, seated: [alan], mode: "Balanced", need: 3, pullSeatedPartners: [] })).includes("dee"));
assert.ok(ids(selectToJoin({ pool, court, seated: [alan], mode: "Balanced", need: 3, pullSeatedPartners: [alan] })).includes("dee"));

// seatJoiners: the partner of a seated player goes on their team; a locked pair arrives on one team.
let [sa, sb] = seatJoiners(["alan"], [], [p("pat", 3), p("dee", 3, { lockedWithId: "alan" }), p("q", 3)], 4);
assert.deepEqual([sa, sb], [["alan", "dee"], ["pat", "q"]]);
[sa, sb] = seatJoiners(["s"], [], [p("u", 3), p("l", 3, { lockedWithId: "m" }), p("m", 3, { lockedWithId: "l" })], 4);
assert.ok(sameTeam([sa, sb], "l", "m"));
assert.deepEqual(seatJoiners([], [], [p("a", 3), p("b", 3)], 2), [["a"], ["b"]]);

// ---- Social shuffle: the front player always plays, the rest avoid recent partners / opponents
const h = (id, extra = {}) => p(id, 3, { games: 1, checkedAt: Number(id.slice(1)) * 60000, partners: [], opponents: [], ...extra });
// no history: exactly the queue-order pick
pool = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"].map((id) => h(id));
assert.equal(ids(selectForCourt({ pool, court, mode: "Balanced", need: 4 })), "a1,a2,a3,a4");
// a1 has just played a2, a3 and a4 as partner and opponent: a1 still plays, but the group is not simply the next three
pool = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"].map((id) => h(id, id === "a1" ? { partners: ["a2", "a3", "a4"], opponents: ["a2", "a3", "a4"] } : {}));
pick = selectForCourt({ pool, court, mode: "Balanced", need: 4 });
assert.ok(pick.taken.some((x) => x.id === "a1"), "the front player always plays");
assert.notEqual(ids(pick), "a1,a2,a3,a4");
// ...but someone who waited much longer is never passed over for variety
pool = [h("a1", { partners: ["a2"] }), p("a2", 3, { games: 1, checkedAt: 0, partners: [], opponents: [] }), h("a3"), h("a4"), h("a5"), h("a6")];
pool[1].checkedAt = 60000 * 1; pool[2].checkedAt = 60000 * 90; pool[3].checkedAt = 60000 * 91; pool[4].checkedAt = 60000 * 92; pool[5].checkedAt = 60000 * 93;
assert.ok(ids(selectForCourt({ pool, court, mode: "Balanced", need: 4 })).includes("a2"), "a long wait beats a repeat partner");
// exactly one court's worth waiting: nothing to choose
pool = ["a1", "a2", "a3", "a4"].map((id) => h(id, { partners: ["a2"] }));
assert.equal(ids(selectForCourt({ pool, court, mode: "Balanced", need: 4 })), "a1,a2,a3,a4");
// the old pick is still there with shuffle off
pool = ["a1", "a2", "a3", "a4", "a5"].map((id) => h(id, id === "a1" ? { partners: ["a2"] } : {}));
assert.equal(ids(selectForCourt({ pool, court, mode: "Balanced", need: 4, shuffle: false })), "a1,a2,a3,a4");
// a locked pair is still pulled in after the shuffle pick
pool = ["a1", "a2", "a3", "a4", "a5", "a6"].map((id) => h(id, id === "a1" ? { lockedWithId: "a6" } : id === "a6" ? { lockedWithId: "a1" } : {}));
assert.ok(ids(selectForCourt({ pool, court, mode: "Balanced", need: 4 })).includes("a6"));

// Challengers: the front player always comes on; the second seat skips someone the winners just faced
const winners = [h("w1", { opponents: ["c1", "c2"] }), h("w2", { opponents: ["c1", "c2"] })];
pool = ["c1", "c2", "c3", "c4", "c5"].map((id) => h(id));
assert.equal(ids(selectToJoin({ pool, court, seated: winners, mode: "Balanced", need: 2, pullSeatedPartners: false })), "c1,c3");

// Mixed Doubles re-pairs: the pairing that repeats fewer partners wins (and every team stays one man + one woman)
g = [mx("m1", "M"), mx("f1", "F"), mx("m2", "M"), mx("f2", "F")];
g[0].partners = ["f1"]; g[1].partners = ["m1"]; g[2].partners = ["f2"]; g[3].partners = ["m2"];
t = splitTeams(g, "Mixed Doubles", true);
assert.deepEqual(t.map((x) => x.slice().sort().join("+")).sort(), ["f1+m2", "f2+m1"]);
assert.deepEqual(splitTeams(g, "Mixed Doubles").map((x) => x.slice().sort().join("+")).sort(), ["f1+m1", "f2+m2"]); // rule off: as before

// Mixed Doubles picks fresh faces too: every group is still two men and two women
pool = ["m1", "f1", "m2", "f2", "m3", "f3", "m4", "f4"].map((id) => h(id, { gender: id[0] === "m" ? "M" : "F", partners: id === "m1" ? ["f1"] : [], opponents: id === "m1" ? ["m2", "f2"] : [] }));
pick = selectForCourt({ pool, court, mode: "Mixed Doubles", need: 4 });
assert.equal(pick.taken.filter((x) => x.gender === "M").length, 2);
assert.ok(pick.taken.some((x) => x.id === "m1"));

// ---- Win rates, locks as units, history window, tie-breaks
// Win rate never overrules stars: the star-balanced split stays even if win rates point the other way.
g = [p("a", 4, { games: 8, wins: 8 }), p("b", 2, { games: 8, wins: 0 }), p("c", 3, { games: 8, wins: 4 }), p("d", 3, { games: 8, wins: 4 })];
t = splitTeams(g, "Balanced", true);
assert.ok(sameTeam(t, "a", "b"), "stars decide first (4+2 vs 3+3)");
// ...but among equally star-balanced splits the win rates even out (the two strong records split up).
g = [p("a", 3, { games: 8, wins: 8 }), p("b", 3, { games: 8, wins: 7 }), p("c", 3, { games: 8, wins: 1 }), p("d", 3, { games: 8, wins: 0 })];
t = splitTeams(g, "Balanced", true);
assert.ok(!sameTeam(t, "a", "b") && !sameTeam(t, "c", "d"), "strong records are split across teams");
// Fewer than 3 games: the record is ignored (new players are unrated for this).
g = [p("a", 3, { games: 2, wins: 2 }), p("b", 3, { games: 2, wins: 2 }), p("c", 3, { games: 2, wins: 0 }), p("d", 3, { games: 2, wins: 0 })];
assert.deepEqual(splitTeams(g, "Balanced", true), splitTeams(g.map((x) => ({ ...x, wins: 1 })), "Balanced", true));

// Tie-break is stable for the same group and games (so a preview matches the real pick) but varies with games played.
g = [p("a", 3), p("b", 3), p("c", 3), p("d", 3)];
const first = JSON.stringify(splitTeams(g, "Balanced", true));
assert.equal(JSON.stringify(splitTeams(g, "Balanced", true)), first);
const seen = new Set();
for (let n = 0; n < 12; n++) seen.add(JSON.stringify(splitTeams(g.map((x) => ({ ...x, games: n })), "Balanced", true)));
assert.ok(seen.size > 1, "equal splits are not always the same one");

// A locked pair is one unit: it is never split by the shuffle, costs nothing as repeat partners, and comes together.
pool = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"].map((id) => h(id, id === "a1" ? { lockedWithId: "a5", partners: ["a5", "a5", "a5"] } : id === "a5" ? { lockedWithId: "a1", partners: ["a1", "a1", "a1"] } : {}));
for (let n = 0; n < 6; n++) {
  pick = selectForCourt({ pool: pool.map((x) => ({ ...x, games: n })), court, mode: "Balanced", need: 4 });
  const got = pick.taken.map((x) => x.id);
  assert.ok(got.includes("a1") === got.includes("a5"), "a locked pair plays together or not at all");
  assert.equal(got.length, 4);
}
// Many locks: still four players, locks together, queue order kept when nothing else is better.
pool = ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"].map((id, i) => h(id, { lockedWithId: ["a2", "a1", "a4", "a3", "a6", "a5", "a8", "a7"][i] }));
pick = selectForCourt({ pool, court, mode: "Balanced", need: 4 });
assert.equal(ids(pick), "a1,a2,a3,a4");
// A lock that the mode can't use is not a unit (Skill Separated across levels).
pool = [p("a", 3, { lockedWithId: "z", checkedAt: 1, games: 0 }), p("b", 3, { checkedAt: 2, games: 0 }), p("c", 3, { checkedAt: 3, games: 0 }), p("d", 3, { checkedAt: 4, games: 0 }), p("e", 3, { checkedAt: 5, games: 0 }), p("z", 5, { lockedWithId: "a", checkedAt: 6, games: 0 })];
assert.ok(!ids(selectForCourt({ pool, court, mode: "Skill Separated", need: 4 })).includes("z"));

// ignoredLocks tells the host which locks the mode can't use
const lk = (id, skill, gender, lockedWithId) => ({ id, name: id, skill, gender, lockedWithId, checked: true });
assert.equal(ignoredLocks([lk("a", 3, "M", "b"), lk("b", 3, "M", "a")], "Mixed Doubles").length, 1);
assert.equal(ignoredLocks([lk("a", 3, "M", "b"), lk("b", 3, "F", "a")], "Mixed Doubles").length, 0);
assert.equal(ignoredLocks([lk("a", 3, "M", "b"), lk("b", 5, "F", "a")], "Skill Separated").length, 1);
assert.equal(ignoredLocks([lk("a", 3, "M", "b"), lk("b", 5, "F", "a")], "Balanced").length, 0);

// History window: one partner and two opponents per game, last N games
const th = trimHistory(["1", "2", "3", "4"], ["a", "b", "c", "d", "e", "f", "g", "h"], 2);
assert.deepEqual(th, { partners: ["3", "4"], opponents: ["e", "f", "g", "h"] });
assert.equal(trimHistory(Array(15).fill("x"), Array(40).fill("y")).partners.length, 10);

console.log("rotationModes checks passed");
