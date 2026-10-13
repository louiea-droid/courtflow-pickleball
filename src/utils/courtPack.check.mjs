// Self-check for removing a court. Run: node src/utils/courtPack.check.mjs
import assert from "node:assert";
import { packCourts } from "./courtPack.js";

const court = (n, extra = {}) => ({ id: `court-${n}`, courtNumber: n, start: 100 + n, teamA: [`a${n}`], teamB: [`b${n}`], ...extra });
const score = (n) => ({ start: 100 + n, t1: n, t2: 0, log: [] });

// Courts 1-3, a volunteer on court 2 and another on court 3, both with a live score. Remove court 1.
const courts = [court(1, { score: score(1) }), court(2, { score: score(2), level: "Advanced" }), court(3, { score: score(3) })];
const claims = [{ id: "court-2", uid: "A", name: "Sam" }, { id: "court-3", uid: "B", name: "Lee" }];
const out = packCourts(courts, "court-1", claims);

// The survivors keep their data AND their score, under contiguous ids.
assert.deepEqual(out.sets.map((s) => s.id), ["court-1", "court-2"]);
assert.deepEqual(out.sets[0].data, { courtNumber: 1, start: 102, teamA: ["a2"], teamB: ["b2"], level: "Advanced", score: score(2) });
assert.equal(out.sets[1].data.score.t1, 3);
assert.deepEqual(out.deletes, ["court-3"]);
// Each volunteer stays with their own match: A's claim moves to court-1, B's to court-2.
assert.deepEqual(out.claimSets, [{ id: "court-1", data: { uid: "A", name: "Sam" } }, { id: "court-2", data: { uid: "B", name: "Lee" } }]);
assert.deepEqual(out.claimDeletes, ["court-3"]);

// A court without a score or a claim stays that way; the removed court's claim goes.
const plain = packCourts([court(1), court(2)], "court-2", [{ id: "court-2", uid: "A", name: "Sam" }]);
assert.equal("score" in plain.sets[0].data, false);
assert.deepEqual(plain.claimSets, []);
assert.deepEqual(plain.claimDeletes, ["court-2"]);
// Ids in any order still pack by court number.
assert.deepEqual(packCourts([court(3), court(1), court(2)], "court-2", []).sets.map((s) => s.data.courtNumber), [1, 2]);
// A game already recorded by one Dashboard keeps that mark when its court is renumbered (so it never records twice).
assert.equal(packCourts([court(1), court(2, { recordedConfirm: 77 })], "court-1", []).sets[0].data.recordedConfirm, 77);
console.log("courtPack checks passed");
