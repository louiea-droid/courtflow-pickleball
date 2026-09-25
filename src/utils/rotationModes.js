import { matchesCourtLevel, skillLevelLabel, pickForLevel } from "./courtLevels.js";

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

function partnerId(p) {
  return p?.lockedWithId || null;
}

// If a picked player's locked partner is still sitting in what's left over
// (checked in, not already playing), pulls the partner in too — bumping out
// whichever other picked player isn't itself completing a lock. This is what
// makes a locked duo travel together: as soon as either of them reaches the
// front of the queue, both come in, and splitTeams keeps them on one side.
// Doubles-only (need === 4) — singles pits opponents 1v1, so there's no
// "teammate" slot for a lock to fill.
function enforceLockedPairs(taken, remaining, mode) {
  const working = [...taken];
  const pool = [...remaining];
  const genderLocked = mode === "Mixed Doubles";
  for (const original of taken) {
    const p = working.find((x) => x.id === original.id);
    if (!p) continue;
    const pid = partnerId(p);
    if (!pid || working.some((x) => x.id === pid)) continue;
    const poolIdx = pool.findIndex((x) => x.id === pid);
    if (poolIdx === -1) continue; // partner not available this round
    const incoming = pool[poolIdx];
    let bumpIdx = -1;
    for (let i = working.length - 1; i >= 0; i--) {
      if (working[i].id === p.id) continue;
      if (genderLocked && working[i].gender !== incoming.gender) continue; // keep the M/F count balanced
      const otherPid = partnerId(working[i]);
      if (otherPid && working.some((x) => x.id === otherPid)) continue; // don't break another satisfied lock
      bumpIdx = i;
      break;
    }
    if (bumpIdx === -1) continue; // no safe seat to free up
    const bumped = working[bumpIdx];
    working[bumpIdx] = incoming;
    pool[poolIdx] = bumped;
  }
  return { taken: working, remaining: pool };
}

// Picks the next `need` players for a court, respecting an explicit
// court-level restriction first, then falling back to the session's mode.
export function selectForCourt({ pool, court, mode, need }) {
  const levelRestricted = Boolean(court?.level && court.level !== "Any Level");
  let result;
  if (levelRestricted) {
    result = pickForLevel(pool, court.level, need);
  } else if (mode === "Skill Separated") {
    result = clusterPick(pool, (p) => skillLevelLabel(p.skill), need);
  } else if (mode === "Winners / Losers") {
    result = clusterPick(pool, (p) => p.lastResult || "new", need);
  } else if (mode === "Mixed Doubles" && need % 2 === 0) {
    result = mixedDoublesPick(pool, need);
  } else if (pool.length < need) {
    result = { taken: [], remaining: pool };
  } else {
    result = { taken: pool.slice(0, need), remaining: pool.slice(need) };
  }
  // A level-restricted court stays reserved for that level even if it means
  // splitting up a locked duo of different skill tiers.
  if (!levelRestricted && need === 4 && result.taken.length === need) {
    return enforceLockedPairs(result.taken, result.remaining, mode);
  }
  return result;
}

function sharedPartnerCount(a, b) {
  return (a.partners || []).includes(b.id) ? 1 : 0;
}

// Star ratings used only for balancing teams (the UI still shows unrated
// players as unrated). An unrated player counts as the average of the rated
// players in the group, so they don't tip the split either way; if nobody is
// rated, everyone is equal and the split falls to the repeat-partner check.
function balanceStars(group) {
  const rated = group.filter((p) => p.skill > 0).map((p) => p.skill);
  const avg = rated.length ? rated.reduce((s, n) => s + n, 0) / rated.length : 0;
  return new Map(group.map((p) => [p.id, p.skill > 0 ? p.skill : avg]));
}

// For a full doubles group, tries all 3 ways to split the 4 selected players
// into two teams of 2. Any split that would put locked partners on opposite
// teams is discarded first. Among what's left:
// - Balanced picks the split whose team star totals are closest (strongest +
//   weakest vs the middle two, e.g. 3★+2★ vs 3★+2★), then fewest repeat
//   partners, then queue order.
// - Any other mode with `avoidRepeats` on picks fewest repeat partners.
// - Otherwise the first (front/back) split.
// Mixed Doubles never re-pairs — its front/back split is what keeps each
// team one M + one F. Non-doubles groups just split front/back.
export function splitTeams(taken, mode, avoidRepeats = false) {
  if (taken.length === 4) {
    const [a, b, c, d] = taken;
    const options = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
    const keepsLocksTogether = ([teamA, teamB]) => {
      const splitsA = teamA.some((x) => partnerId(x) && teamB.some((y) => y.id === partnerId(x)));
      const splitsB = teamB.some((x) => partnerId(x) && teamA.some((y) => y.id === partnerId(x)));
      return !splitsA && !splitsB;
    };
    const valid = options.filter(keepsLocksTogether);
    const candidates = valid.length ? valid : options;
    const balanced = mode === "Balanced";
    if (balanced || (avoidRepeats && mode !== "Mixed Doubles")) {
      const stars = balanced ? balanceStars(taken) : null;
      const teamStars = (team) => stars.get(team[0].id) + stars.get(team[1].id);
      let best = candidates[0];
      let bestGap = Infinity;
      let bestRepeats = Infinity;
      for (const [teamA, teamB] of candidates) {
        // Rounded so an averaged (fractional) unrated rating can't break a real tie with float noise.
        const gap = balanced ? Math.round(Math.abs(teamStars(teamA) - teamStars(teamB)) * 1000) : 0;
        const repeats = sharedPartnerCount(teamA[0], teamA[1]) + sharedPartnerCount(teamB[0], teamB[1]);
        // Strict < keeps the earlier (queue-order) split on a full tie.
        if (gap < bestGap || (gap === bestGap && repeats < bestRepeats)) {
          best = [teamA, teamB]; bestGap = gap; bestRepeats = repeats;
        }
      }
      return [best[0].map((p) => p.id), best[1].map((p) => p.id)];
    }
    const [teamA, teamB] = candidates[0];
    return [teamA.map((p) => p.id), teamB.map((p) => p.id)];
  }
  const half = Math.ceil(taken.length / 2);
  return [taken.slice(0, half).map((p) => p.id), taken.slice(half).map((p) => p.id)];
}
