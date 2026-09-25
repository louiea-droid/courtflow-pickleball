// Self-check for readable text on theme colors. Run: node src/utils/theme.check.mjs
import assert from "node:assert";
import { readableOn } from "./theme.js";
import { ACCENT_PRESETS, TEAM_PRESETS } from "../data/constants.js";

// Every preset keeps white text, as it looked before the check existed.
for (const { value } of [...ACCENT_PRESETS, ...TEAM_PRESETS]) assert.equal(readableOn(value), "#fff", value);

// Light custom picks flip to dark ink; dark ones stay white.
for (const light of ["#ffffff", "#f5d000", "#9be7ff", "#b6f5a0"]) assert.equal(readableOn(light), "#0f1b15", light);
for (const dark of ["#000000", "#1b3a8a", "#8b1e3f"]) assert.equal(readableOn(dark), "#fff", dark);

console.log("theme checks passed");
