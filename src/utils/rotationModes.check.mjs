// Self-check for Balanced team splitting. Run: node src/utils/rotationModes.check.mjs
import assert from "node:assert";
import { selectForCourt, selectToJoin, splitTeams } from "./rotationModes.js";

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

// No tier has four: the court waits.
pool = [p("a1", 3), p("a2", 3), p("e1", 5), p("e2", 5), p("b1", 1)];
assert.equal(ids(selectForCourt({ pool, court, mode: "Skill Separated", need: 4 })), "");

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

console.log("rotationModes checks passed");
