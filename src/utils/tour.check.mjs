// node src/utils/tour.check.mjs: every tour step points at something that exists in the app's source.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { NAV_ITEMS } from "../data/constants.js";
import { tourSteps } from "../data/tour.js";

const src = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith(".jsx") ? [p] : [];
});
const code = files(decodeURIComponent(src)).map((f) => readFileSync(f, "utf8")).join("\n");
const tabs = new Set(NAV_ITEMS.map((n) => n.key));

for (const kind of ["quick", "event"]) {
  const steps = tourSteps(kind);
  assert.ok(steps.length >= 5, `${kind}: a real tour`);
  assert.ok(!steps[0].target, `${kind}: starts with a welcome card`);
  for (const s of steps) {
    assert.ok(tabs.has(s.tab), `${kind}: unknown tab ${s.tab}`);
    assert.ok(s.title && s.body, `${kind}: every step has words`);
    const tag = s.target?.match(/data-tour="([^"]+)"/)?.[1];
    if (tag?.startsWith("nav-")) assert.ok(tabs.has(tag.slice(4)), `${kind}: no sidebar tab ${tag}`);
    if (tag?.startsWith("nav-")) assert.ok(code.includes("data-tour={`nav-${"), "sidebar tabs carry data-tour");
    else if (tag) assert.ok(code.includes(`data-tour="${tag}"`), `${kind}: nothing has data-tour="${tag}"`);
  }
}
for (const s of [...tourSteps("quick"), ...tourSteps("event")]) {
  if (s.open) assert.ok(["umpires"].includes(s.open), `QueueApp only opens the Umpires window, not ${s.open}`);
  if (s.image) assert.ok(existsSync(fileURLToPath(new URL(`../../public${s.image.src}`, import.meta.url))), `missing public${s.image.src}`);
}
assert.equal(tourSteps("quick").at(-1).tab, "guide", "ends on the Guide, where the tour starts again");
console.log("tour.check: ok");
