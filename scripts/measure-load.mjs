// Times how long each screen takes to show on a slow phone (Slow-4G-ish network, 4x slower CPU), from a cold start.
// Usage: npx vite build --mode emulator --outDir dist-emu && npx vite preview --outDir dist-emu --port 5301, then
// node scripts/measure-load.mjs http://localhost:5301 [label]  (emulators running, seeded with scripts/seed-help.mjs)
import { chromium } from "@playwright/test";

const base = process.argv[2] || "http://localhost:5301";
const label = process.argv[3] || "run";
const NET = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

async function timed(browser, { name, path, ready, login, warm }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  if (login) { // sign in first (unthrottled), so the timed load is a signed-in cold open of the page
    await page.goto(`${base}/signin`);
    await page.getByRole("textbox", { name: "Email" }).fill(login);
    await page.getByRole("textbox", { name: "Password" }).fill("password1");
    await page.getByRole("button", { name: "Sign in" }).nth(1).click();
    await page.waitForURL(`${base}/`);
    await page.waitForTimeout(1500);
    await page.close();
  }
  if (warm) { // visit once first, so the timed load is a returning visitor (HTTP cache and Firestore cache filled)
    const w = await ctx.newPage();
    await w.goto(base + path);
    await w.locator(ready).first().waitFor({ state: "visible", timeout: 60000 });
    await w.waitForTimeout(1500);
    await w.close();
  }
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: !login && !warm }); // signed-in runs keep the HTTP cache (a returning visitor)
  await cdp.send("Network.emulateNetworkConditions", NET);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  let bytes = 0;
  cdp.on("Network.loadingFinished", (e) => { bytes += e.encodedDataLength; });
  const t0 = Date.now();
  await p.goto(base + path, { waitUntil: "commit" });
  await p.locator(ready).first().waitFor({ state: "visible", timeout: 60000 });
  const ms = Date.now() - t0;
  const fcp = await p.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0);
  await ctx.close();
  return { name, ms, fcp: Math.round(fcp), kB: Math.round(bytes / 1024) };
}

const browser = await chromium.launch();
const cases = [
  { name: "Landing (signed out, first visit)", path: "/", ready: "text=Catch your" },
  { name: "Sign-in page (first visit)", path: "/signin", ready: "role=heading[name='Sign in']" },
  { name: "Quick session /club (first visit)", path: "/club", ready: "text=Live Court Rotation" },
  { name: "Quick session /club (returning)", path: "/club", ready: "text=Live Court Rotation", warm: true },
  { name: "Home (signed in, returning)", path: "/", ready: "#home-upcoming-title", login: "ann@demo.test" },
  { name: "Club game (signed in, returning)", path: "/clubs/pub/event/thursday/game", ready: "text=Live Court Rotation", login: "ann@demo.test" },
];
const rows = [];
for (const c of cases) {
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await timed(browser, c));
  runs.sort((a, b) => a.ms - b.ms);
  rows.push(runs[1]); // median of 3
}
await browser.close();
console.log(`\n${label}`);
console.table(rows);
