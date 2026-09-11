import { matchesCourtLevel, skillLevelLabel, pickForLevel } from "./courtLevels";

// Groups by a shared key (skill tier, last result, ...), anchored on whoever's
// at the front of the queue. Only commits if a full group is actually
// available — otherwise the court waits rather than mixing groups.
function clusterPick(pool, keyFn, need) {
  if (!pool.length) return { taken: [], remaining: pool };
  const targetKey = keyFn(pool[0]);
  const taken = [];
  const remaining = [];
  for (const p of pool) {
    if (taken.length < need && keyFn(p) === targetKey) taken.push(p);
    else remaining.push(p);
  }
  if (taken.length < need) return { taken: [], remaining: pool };
  return { taken, remaining };
}

// Pulls pairs so the result reads [M, F, M, F, ...] — splitting that in half
// down the middle naturally gives each side one of each.
function mixedDoublesPick(pool, need) {
  const pairsNeeded = Math.floor(need / 2);
  const males = pool.filter((p) => p.gender === "M");
  const females = pool.filter((p) => p.gender === "F");
  if (males.length < pairsNeeded || females.length < pairsNeeded) {
    return { taken: [], remaining: pool };
  }
  const takenMales = males.slice(0, pairsNeeded);
  const takenFemales = females.slice(0, pairsNeeded);
  const takenIds = new Set([...takenMales, ...takenFemales].map((p) => p.id));
  const taken = [];
  for (let i = 0; i < pairsNeeded; i++) taken.push(takenMales[i], takenFemales[i]);
  const remaining = pool.filter((p) => !takenIds.has(p.id));
  return { taken, remaining };
}

// Picks the next `need` players for a court, respecting an explicit
// court-level restriction first, then falling back to the session's mode.
export function selectForCourt({ pool, court, mode, need }) {
  if (court?.level && court.level !== "Any Level") {
    return pickForLevel(pool, court.level, need);
  }
  const eligible = pool;
  if (mode === "Skill Separated") return clusterPick(eligible, (p) => skillLevelLabel(p.skill), need);
  if (mode === "Winners / Losers") return clusterPick(eligible, (p) => p.lastResult || "new", need);
  if (mode === "Mixed Doubles" && need % 2 === 0) return mixedDoublesPick(eligible, need);
  if (eligible.length < need) return { taken: [], remaining: eligible };
  return { taken: eligible.slice(0, need), remaining: eligible.slice(need) };
}

function sharedPartnerCount(a, b) {
  return (a.partners || []).includes(b.id) ? 1 : 0;
}

// For Balanced mode with a full doubles group, tries all 3 ways to split the
// 4 selected players into two teams of 2 and keeps whichever pairing repeats
// the fewest recent partnerships. Everything else just splits front/back.
export function splitTeams(taken, mode) {
  if (taken.length === 4 && mode === "Balanced") {
    const [a, b, c, d] = taken;
    const options = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
    let best = options[0];
    let bestScore = Infinity;
    for (const [teamA, teamB] of options) {
      const score = sharedPartnerCount(teamA[0], teamA[1]) + sharedPartnerCount(teamB[0], teamB[1]);
      if (score < bestScore) { bestScore = score; best = [teamA, teamB]; }
    }
    return [best[0].map((p) => p.id), best[1].map((p) => p.id)];
  }
  const half = Math.ceil(taken.length / 2);
  return [taken.slice(0, half).map((p) => p.id), taken.slice(half).map((p) => p.id)];
}
