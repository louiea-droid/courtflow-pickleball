// Run: node src/utils/selfCheckin.check.mjs
import assert from "node:assert/strict";
import { LEVEL_CHOICES, checkinTarget, checkinUrl, matchName, needsLevel, newCheckinCode, normName, validCode } from "./selfCheckin.js";

const P = (id, name, skill) => ({ id, name, skill });
const ps = [P("1", "Ana Reyes", 3), P("2", "Ana Cruz"), P("3", "Gus Lim", 3), P("4", "José Rizal", 2), P("5", "Bo  Santos", 4)];

assert.equal(normName("  José   RIZAL "), "jose rizal");
assert.deepEqual(matchName(ps, "ana reyes").players.map((p) => p.id), ["1"]);
assert.equal(matchName(ps, "ANA  REYES ").kind, "exact");
assert.equal(matchName(ps, "jose rizal").kind, "exact", "accents ignored");
assert.equal(matchName(ps, "bo santos").kind, "exact", "extra spaces in the stored name");
const ana = matchName(ps, "Ana");
assert.equal(ana.kind, "few");
assert.deepEqual(ana.players.map((p) => p.id).sort(), ["1", "2"]);
assert.deepEqual(matchName(ps, "ana c").players.map((p) => p.id), ["2"], "word starts narrow it down");
assert.equal(matchName(ps, "ana c").kind, "exact");
assert.deepEqual(matchName(ps, "gus lym"), { kind: "suggest", players: [ps[2]] });
assert.equal(matchName(ps, "zed").kind, "none");
assert.equal(matchName(ps, "a").kind, "none", "too short to guess");
const many = Array.from({ length: 6 }, (_, i) => P(`m${i}`, `Mark ${i}`));
const m = matchName(many, "mark");
assert.equal(m.kind, "none"); assert.equal(m.tooMany, true, "never lists more than 4");

assert.equal(needsLevel(ps[0]), false);
assert.equal(needsLevel(ps[1]), true);
assert.equal(needsLevel(null), true);
assert.equal(LEVEL_CHOICES.length, 6);
assert.deepEqual(LEVEL_CHOICES.map((l) => l.stars), [1, 2, 3, 4, 5, 6]);

for (let i = 0; i < 50; i++) assert.ok(validCode(newCheckinCode()));
assert.equal(validCode("123"), false); assert.equal(validCode("12a4"), false);
assert.equal(checkinUrl("https://x.app", "pub", "e 1"), "https://x.app/checkin?club=pub&event=e%201");
assert.deepEqual(checkinTarget("?club=pub&event=e1"), { clubId: "pub", eventId: "e1", base: ["clubs", "pub", "events", "e1"] });
assert.equal(checkinTarget("?club=pub"), null);
assert.equal(checkinTarget("?club=pub&event=e1&code=4827").code, "4827", "a QR made with the code off carries it");
assert.equal(checkinTarget("?club=pub&event=e1&code=12").code, undefined, "a malformed code is ignored");
console.log("selfCheckin.check: ok");
