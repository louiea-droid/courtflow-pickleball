// Self-check for readable text on theme colors. Run: node src/utils/theme.check.mjs
import assert from "node:assert";
import { applyGlobalTheme, getGlobalTheme, readableOn, setGlobalTheme } from "./theme.js";
import { ACCENT_PRESETS, TEAM_PRESETS } from "../data/constants.js";

// Every preset keeps white text, as it looked before the check existed.
for (const { value } of [...ACCENT_PRESETS, ...TEAM_PRESETS]) assert.equal(readableOn(value), "#fff", value);

// Light custom picks flip to dark ink; dark ones stay white.
for (const light of ["#ffffff", "#f5d000", "#9be7ff", "#b6f5a0"]) assert.equal(readableOn(light), "#0f1b15", light);
for (const dark of ["#000000", "#1b3a8a", "#8b1e3f"]) assert.equal(readableOn(dark), "#fff", dark);

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value),
};
const cssVars = new Map();
globalThis.document = {
  documentElement: {
    dataset: {},
    style: {
      getPropertyValue: (key) => cssVars.get(key) || "",
      setProperty: (key, value) => cssVars.set(key, value),
    },
  },
};

assert.equal(getGlobalTheme(), "system");
setGlobalTheme("dark");
assert.equal(getGlobalTheme(), "dark");
applyGlobalTheme({ theme: "light" }, { persist: false });
assert.equal(document.documentElement.dataset.theme, "dark");
storage.set("courtflow-global-theme", "unknown");
assert.equal(getGlobalTheme(), "system");

console.log("theme checks passed");
