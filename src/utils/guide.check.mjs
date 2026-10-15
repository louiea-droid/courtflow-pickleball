// node src/utils/guide.check.mjs: every Guide card has its details, and every screenshot it names exists.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { GUIDE_FEATURES } from "../data/guide.js";

const pub = fileURLToPath(new URL("../../public", import.meta.url));
const ids = new Set();
for (const f of GUIDE_FEATURES) {
  assert.ok(!ids.has(f.id), `duplicate id ${f.id}`); ids.add(f.id);
  assert.ok(f.title && f.card && f.summary, `${f.id}: title, card and summary`);
  assert.ok(f.steps.length >= 2, `${f.id}: at least two steps`);
  assert.ok(f.shots.length >= 1, `${f.id}: at least one screenshot`);
  for (const s of f.shots) {
    assert.ok(s.w > 0 && s.h > 0 && s.alt && s.caption, `${f.id}: ${s.src} needs w, h, alt and caption`);
    assert.ok(existsSync(pub + s.src), `${f.id}: missing public${s.src} (see docs/help-screenshots.md)`);
  }
}
assert.ok(ids.has("umpires"), "the Umpires card holds the volunteer umpire guide");
console.log("guide.check: ok");
