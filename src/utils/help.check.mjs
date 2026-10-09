import assert from "node:assert/strict";
import { DEFAULT_RULES } from "../data/constants.js";
import { DEFAULT_GAME_MINUTES } from "./queueStatus.js";
import { MAJOR, MINOR } from "../data/help.js";
import { filterHelp } from "./help.js";

assert.equal(MAJOR.length, 6);
assert.equal(MAJOR.at(-1).id, "queue");
assert.equal(MAJOR.at(-1).featured, true);
const ids = [...MAJOR, ...MINOR].map((s) => s.id);
assert.equal(new Set(ids).size, ids.length, "ids are unique");
for (const s of MAJOR) {
  assert.ok(s.title && s.summary && s.steps.length >= 3, `${s.id} has a title, summary and 3+ steps`);
  assert.ok(s.shots.length >= 1, `${s.id} has a screenshot`);
  for (const shot of s.shots) {
    assert.match(shot.src, /^\/help\/[a-z0-9-]+\.png$/, `${s.id} shot path`);
    assert.ok(shot.alt.length > 20 && shot.caption, `${s.id} shot needs alt text and a caption`);
    assert.ok(shot.w > 0 && shot.h > 0, `${s.id} shot needs its width and height (no layout jump)`);
  }
}
for (const m of MINOR) assert.ok(m.title && m.body, `${m.id} has a title and body`);
assert.ok(MINOR.length >= 10);
// Drift guards: the numbers the queue section states must be the code's numbers
const queueText = JSON.stringify(MAJOR.at(-1));
assert.ok(queueText.includes(`${DEFAULT_GAME_MINUTES} minutes`), "the wait estimate says the game length the code uses");
assert.ok(queueText.includes(`${DEFAULT_RULES.maxWinStreak} wins in a row`), "the win-streak cap says the code's default");
assert.ok(queueText.includes("fewest games"), "the pick order is stated");
for (const mode of ["Balanced", "Skill Separated", "Custom", "Winners / Losers", "Mixed Doubles"]) assert.ok(queueText.includes(mode), `${mode} is explained`);
// Statements the code review corrected: keep them true
assert.ok(queueText.includes("since their last game"), "the tie-break is who has waited longer, not only who checked in first");
assert.ok(queueText.includes("moved you back"), "the host can move a player back");
assert.ok(queueText.includes("Quick session") && queueText.includes("Club games don't have one yet"), "the Live Board belongs to the Quick session");
assert.ok(queueText.includes("member of the club"), "the active session card is for club members");
assert.ok(queueText.includes("Back to game") && queueText.includes("Not Checked In by player name"), "the active game shortcut and player search are documented");
assert.ok(queueText.includes("New arrivals"), "Winners / Losers groups new arrivals");
assert.ok(queueText.includes("Auto-rotation"), "Auto-rotation is explained");
assert.ok(!queueText.includes("the one who checked in earlier goes first"), "the old tie-break sentence is gone");
const all = JSON.stringify([MAJOR, MINOR]);
assert.ok(all.includes("Match my device") && !all.includes("Light, Dark or System"), "the profile theme option is named as in the app");
// Search
assert.equal(filterHelp("").major.length, 6);
assert.ok(filterHelp("waitlist").major.some((s) => s.id === "open-play"));
assert.ok(filterHelp("  ESC ").minor.some((m) => m.id === "keyboard"));
assert.equal(filterHelp("zzzznothing").major.length + filterHelp("zzzznothing").minor.length, 0);
console.log("help.check: ok");
