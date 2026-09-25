// Self-check for Balanced team splitting. Run: node src/utils/rotationModes.check.mjs
import assert from "node:assert";
import { splitTeams } from "./rotationModes.js";

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

console.log("rotationModes checks passed");
