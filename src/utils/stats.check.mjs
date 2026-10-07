// Self-check for the match count. Run: node src/utils/stats.check.mjs
import assert from "node:assert";
import { matchCount } from "./stats.js";

const four = [1, 2, 3, 4].map(() => ({ games: 1 }));
assert.equal(matchCount(four, "Doubles"), 1); // one doubles match = four player-games
assert.equal(matchCount(four, undefined), 1); // no format yet: doubles, the default
assert.equal(matchCount([{ games: 1 }, { games: 1 }], "Singles"), 1);
assert.equal(matchCount([{ games: 3 }, { games: 3 }, { games: 3 }, { games: 3 }], "Doubles"), 3);
assert.equal(matchCount([], "Doubles"), 0);
assert.equal(matchCount([{}, {}], "Doubles"), 0); // players with no games field yet

console.log("stats.check: ok");
