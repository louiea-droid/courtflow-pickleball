// Self-check for the Live Board link and the booking page's live strip. Run: node src/utils/liveBoard.check.mjs
import assert from "node:assert";
import { LIVE_AFTER_END_MS, liveChips, liveTarget, liveUrl } from "./liveBoard.js";

// A game's board: club, event and key.
const url = liveUrl("https://x.test", "c1", "e 1", "K3Y");
assert.equal(url, "https://x.test/live?club=c1&event=e%201&key=K3Y");
assert.deepEqual(liveTarget(new URL(url).search), { kind: "event", base: ["clubs", "c1", "events", "e 1"], key: "K3Y" });
// The quick session's board keeps its old link (the key is optional there).
assert.deepEqual(liveTarget("?club=u1"), { kind: "quick", base: ["sessions", "u1"], key: null });
assert.deepEqual(liveTarget("?club=u1&key=abc"), { kind: "quick", base: ["sessions", "u1"], key: "abc" });
// A game link needs its key; no club is no board.
assert.equal(liveTarget("?club=c1&event=e1"), null);
assert.equal(liveTarget(""), null);
assert.equal(liveTarget("?event=e1&key=k"), null);

assert.equal(LIVE_AFTER_END_MS, 12 * 60 * 60 * 1000);

// Chips: only courts with players and a score for the current match, in court order.
const courts = [
  { id: "court-2", courtNumber: 2, start: 5, teamA: ["a"], teamB: ["b"], score: { start: 5, t1: 7, t2: 5 } },
  { id: "court-1", courtNumber: 1, name: "Center", start: 9, teamA: ["c"], teamB: ["d"], score: { start: 9, t1: 1, t2: 0 } },
  { id: "court-3", courtNumber: 3, start: 3, teamA: ["e"], teamB: ["f"], score: { start: 2, t1: 9, t2: 9 } }, // an old match
  { id: "court-4", courtNumber: 4, start: 4, teamA: [], teamB: [], score: { start: 4, t1: 3, t2: 3 } }, // empty court
  { id: "court-5", courtNumber: 5, start: 6, teamA: ["g"], teamB: ["h"] }, // nobody scoring
];
assert.deepEqual(liveChips(courts), [
  { id: "court-1", name: "Center", t1: 1, t2: 0 },
  { id: "court-2", name: "Court 2", t1: 7, t2: 5 },
]);
assert.deepEqual(liveChips([]), []);
console.log("liveBoard checks passed");
