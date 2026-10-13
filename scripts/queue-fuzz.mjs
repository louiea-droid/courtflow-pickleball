// Randomized invariant check of the queue logic: node scripts/queue-fuzz.mjs [rounds]
// Throws random players (skills, genders, locks, histories, odd missing fields) at the real pick / split /
// seat functions in every mode and checks rules that must always hold. Prints the first failures.
import {
  ignoredLocks, seatJoiners, selectForCourt, selectToJoin, splitTeams, validLock, trimHistory,
} from "../src/utils/rotationModes.js";

let seed = 12345;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const int = (n) => Math.floor(rand() * n);
const pick = (a) => a[int(a.length)];
const MODES = ["Balanced", "Skill Separated", "Winners / Losers", "Mixed Doubles", "Custom"];
const failures = new Map();
const fail = (name, ctx) => { if (!failures.has(name)) failures.set(name, ctx); failures.get(name).count = (failures.get(name).count || 0) + 1; };

function makePool(n, { locks, gender, history }) {
  const ps = Array.from({ length: n }, (_, i) => {
    const p = { id: "p" + i, name: "P" + i, skill: pick([0, 1, 2, 3, 3, 4, 5, 6, undefined]), games: int(5), checkedAt: 1000 + i * 60000 + int(30000), checked: true };
    if (gender) p.gender = rand() < 0.1 ? undefined : pick(["M", "F"]);
    if (rand() < 0.5) { p.wins = int(p.games + 1); p.lastResult = pick(["win", "loss", undefined]); }
    return p;
  });
  if (locks) {
    const free = ps.map((p) => p.id).sort(() => rand() - 0.5);
    for (let k = 0; k < locks && free.length >= 2; k++) {
      const ia = free.pop(), ib = free.pop(); const a = ps.find((p) => p.id === ia), b = ps.find((p) => p.id === ib);
      a.lockedWithId = b.id; b.lockedWithId = a.id;
    }
  }
  if (history) for (const p of ps) {
    const others = ps.filter((q) => q.id !== p.id);
    if (!others.length) continue;
    p.partners = Array.from({ length: int(8) }, () => pick(others).id);
    p.opponents = Array.from({ length: int(14) }, () => pick(others).id);
  }
  return ps.sort((a, b) => a.games - b.games || a.checkedAt - b.checkedAt);
}

const rounds = Number(process.argv[2]) || 4000;
let checks = 0;
for (let r = 0; r < rounds; r++) {
  const mode = pick(MODES);
  const need = rand() < 0.15 ? 2 : 4;
  const n = 1 + int(24);
  const pool = makePool(n, { locks: int(5), gender: rand() < 0.7, history: rand() < 0.7 });
  const level = rand() < 0.2 ? pick(["Beginner", "Intermediate", "Advanced"]) : undefined;
  const court = { id: "c", level };
  const now = 1000 + n * 60000 + int(3600000);
  const ctx = { mode, need, level, n, seed: r };
  let res;
  try { res = selectForCourt({ pool, court, mode, need, now }); } catch (e) { fail("selectForCourt threw: " + e.message, ctx); continue; }
  const { taken, remaining } = res;
  checks++;
  const ids = (a) => a.map((p) => p.id);
  const all = [...ids(taken), ...ids(remaining)];
  if (new Set(ids(taken)).size !== taken.length) fail("duplicate player in a pick", ctx);
  if (all.length !== pool.length || new Set(all).size !== pool.length || !pool.every((p) => all.includes(p.id))) fail("taken + remaining is not the pool", ctx);
  if (taken.length !== 0 && taken.length !== need) fail("pick is neither empty nor a full match", { ...ctx, got: taken.length });
  if (mode === "Custom" && taken.length) fail("Custom picked someone", ctx);
  if (pool.length >= need && mode === "Balanced" && !level && taken.length !== need) fail("Balanced left a court empty with enough players", ctx);
  // (a front player may wait one round when honoring locks needs every seat: two locked pairs fill the court)
  const lockedPairsTaken = taken.filter((p) => p.lockedWithId && ids(taken).includes(p.lockedWithId)).length;
  if (mode === "Balanced" && !level && taken.length === need && pool.length > need && !ids(taken).includes(pool[0].id) && !(pool[0].lockedWithId ? false : lockedPairsTaken >= 4)) {
    fail("Balanced: front player was skipped", { ...ctx, pool: pool.map((p) => [p.id, p.skill, p.games, p.lockedWithId, p.gender].join("/")), taken: ids(taken).join() });
  }
  // order is deterministic (so a preview matches the real pick)
  const again = selectForCourt({ pool, court, mode, need, now });
  if (ids(again.taken).join() !== ids(taken).join()) fail("pick is not stable between identical calls", ctx);
  if (taken.length === need) {
    // level court only holds that level
    // mixed doubles: two men and two women
    if (mode === "Mixed Doubles" && !level && need === 4) {
      const m = taken.filter((p) => p.gender === "M").length, f = taken.filter((p) => p.gender === "F").length;
      if (m !== 2 || f !== 2) fail("Mixed Doubles group is not 2 men + 2 women", { ...ctx, m, f });
    }
    // locks: a partner who is waiting in the pool with a valid lock is never left behind
    if (need === 4 && !level) for (const p of taken) {
      const mate = p.lockedWithId && pool.find((x) => x.id === p.lockedWithId);
      if (!mate || ids(taken).includes(mate.id)) continue;
      const sameLevel = mode !== "Skill Separated" || (p.skill ?? "u") === (mate.skill ?? "u");
      if (validLock(p, mate, mode) && sameLevel && mode !== "Custom" && ids(remaining).includes(mate.id)) {
        // allowed only when no seat could be freed (every other player is part of a satisfied lock); flag if a free seat exists
        const freeSeat = taken.some((x) => x.id !== p.id && !(x.lockedWithId && ids(taken).includes(x.lockedWithId)) && (mode !== "Mixed Doubles" || x.gender === mate.gender));
        if (freeSeat) fail("a locked partner was left behind although a seat could be freed", { ...ctx, p: p.id, mate: mate.id });
      }
    }
    // split: two teams, nobody twice, locks together, mixed teams 1M+1F, never throws
    let split;
    try { split = splitTeams(taken, mode, rand() < 0.5); } catch (e) { fail("splitTeams threw: " + e.message, ctx); continue; }
    const flat = split.flat();
    if (flat.length !== taken.length || new Set(flat).size !== taken.length) fail("split lost or repeated a player", ctx);
    if (need === 4 && (split[0].length !== 2 || split[1].length !== 2)) fail("split is not 2 + 2", ctx);
    if (need === 2 && (split[0].length !== 1 || split[1].length !== 1)) fail("singles split is not 1 v 1", ctx);
    if (need === 4) for (const p of taken) {
      const mate = taken.find((x) => x.id === p.lockedWithId);
      if (mate && validLock(p, mate, mode) && split[0].includes(p.id) !== split[0].includes(mate.id)) fail("a locked pair was split across teams", { ...ctx, p: p.id });
    }
    if (mode === "Mixed Doubles" && need === 4 && !level && taken.every((p) => p.gender)) {
      for (const t of split) {
        const g = t.map((id) => taken.find((x) => x.id === id).gender);
        if (g[0] === g[1]) fail("Mixed Doubles team is not 1 man + 1 woman", ctx);
      }
    }
    const s2 = splitTeams(taken, mode, true);
    if (JSON.stringify(s2) !== JSON.stringify(splitTeams(taken, mode, true))) fail("split is not stable between identical calls", ctx);
  }

  // joining a half-filled court (winners stay on / top up)
  if (need === 4 && pool.length > 4) {
    const seated = pool.slice(0, 2); const rest = pool.slice(2);
    for (const m of MODES) {
      let j;
      try { j = selectToJoin({ pool: rest, court: { id: "c" }, seated, mode: m, need: 2, pullSeatedPartners: false }); } catch (e) { fail("selectToJoin threw: " + e.message, { m }); continue; }
      const ji = ids(j.taken);
      if (ji.some((id) => ids(seated).includes(id))) fail("a seated player was picked again", { m });
      if (new Set(ji).size !== ji.length) fail("duplicate challenger", { m });
      if (j.taken.length !== 0 && j.taken.length !== 2) fail("challenger pick is not 0 or 2", { m, got: j.taken.length });
      if (new Set([...ids(j.taken), ...ids(j.remaining)]).size !== rest.length) fail("join lost or invented players", { m });
    }
    // seating joiners never overfills a team or repeats a player
    const joiners = rest.slice(0, 3);
    const [A, B] = seatJoiners(["x"], [], joiners, 4, null);
    if (A.length > 2 || B.length > 2 || new Set([...A, ...B]).size !== A.length + B.length) fail("seatJoiners overfilled or repeated", {});
  }
  // lock banner helper never throws
  ignoredLocks(pool, mode);
  trimHistory(pool[0]?.partners || [], pool[0]?.opponents || []);
}

console.log(`${checks} random picks checked across ${MODES.length} modes`);
if (!failures.size) console.log("no rule broken");
else for (const [name, c] of failures) console.log(`FAIL ${name} (x${c.count}) e.g. ${JSON.stringify({ ...c, count: undefined })}`);
process.exit(failures.size ? 1 : 0);
