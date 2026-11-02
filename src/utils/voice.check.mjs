import assert from "node:assert/strict";
import { callParts, callRuns, callText, courtClipId, nameClipId, spokenName } from "./voice.js";

assert.equal(spokenName({ name: "qqweq", sayAs: "Kwek kwek" }), "Kwek kwek");
assert.equal(spokenName({ name: "Ana", sayAs: "  " }), "Ana");
assert.equal(spokenName({ name: "Ana" }), "Ana");
assert.equal(spokenName(undefined), "");

assert.equal(callText("next", "Court 1", ["Ana", "Ben"], ["Cy", "Di"]), "Court 1, next up: Ana and Ben, versus Cy and Di. Please get ready.");
assert.equal(callText("start", "Center", ["Ana", "Ben"], ["Cy", "Di"]), "Center: Ana and Ben, versus Cy and Di. Please go to Center.");
assert.equal(callText("next", "", ["Ana", "Ben"], ["Cy", "Di"]), "Next up: Ana and Ben, versus Cy and Di. Please get ready."); // a line match: no court yet
assert.equal(callParts("next", "", [{ name: "Ana" }])[0].id, "p_next-up");
assert.equal(callText("next", "Court 2", ["Ana"], ["Cy"]), "Court 2, next up: Ana, versus Cy. Please get ready.");
assert.equal(callText("next", "Court 2", ["Ana", "Ben"], []), "Court 2, next up: Ana and Ben. Please get ready.");
assert.equal(callText("next", "Court 2", [], []), "");

// Recording ids: the same court or name in another spelling of spaces / case is the same recording.
assert.equal(courtClipId(" Court  1 "), courtClipId("court 1"));
assert.equal(nameClipId("Ana Cruz"), nameClipId("ana  cruz"));
assert.notEqual(nameClipId("Ana"), nameClipId("Anna"));
assert.ok(!nameClipId("a/b").includes("/")); // a Firestore id can't hold a slash

const A = [{ name: "Ana" }, { name: "Ben", sayAs: "Benn" }], B = [{ name: "Cy" }, { name: "Di" }];
const next = callParts("next", "Court 1", A, B);
assert.deepEqual(next.map((p) => p.text), ["Court 1", "next up", "Ana", "and", "Benn", ", versus", "Cy", "and", "Di", ". Please get ready."]);
assert.equal(next[0].id, courtClipId("Court 1"));
assert.equal(next[4].id, nameClipId("Ben")); // the recording follows the name, the built-in voice the spelling
const start = callParts("start", "Center", A, B);
assert.deepEqual(start.map((p) => p.text), ["Center", "Ana", "and", "Benn", ", versus", "Cy", "and", "Di", ". Please go to", "Center"]);
assert.deepEqual(callParts("next", "Court 1", [], []), []);
assert.deepEqual(callParts("next", "Court 1", [{ name: "Ana" }], []).map((p) => p.text), ["Court 1", "next up", "Ana", ". Please get ready."]);

// Runs: recorded pieces play alone, the gaps between are said together.
const clips = { [courtClipId("Court 1")]: "data:a", p_versus: "data:v" };
assert.deepEqual(callRuns(next, clips), [
  { audio: "data:a" }, { text: "next up Ana and Benn" }, { audio: "data:v" }, { text: "Cy and Di . Please get ready." },
]);
assert.deepEqual(callRuns(next, {}), [{ text: next.map((p) => p.text).join(" ") }]);
console.log("voice ok");
