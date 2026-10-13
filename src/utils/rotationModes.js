import { matchesCourtLevel, skillLevelLabel, pickForLevel } from "./courtLevels.js";

// ---- Social shuffle. Fairness comes first: the front player (fewest games, longest wait) always plays.
// Only the other seats are chosen, from the next few in the queue, by the fewest recent repeat
// partners (heavy) and opponents (light). Skipping someone who waited longer costs more than a repeat
// saves, so variety only wins when the wait difference is small. No history (or a pool no bigger than
// the court) gives exactly the old queue-order pick. A locked pair is one unit in the window: it can't
// change partners, so that repeat costs nothing, and the pair always travels together.
export const SHUFFLE_WINDOW = 6;
export const HISTORY_GAMES = 10; // how many recent games of partners / opponents are remembered
const PARTNER_WEIGHT = 3;
const recency = (list, id) => {
  const i = (list || []).lastIndexOf(id);
  return i < 0 ? 0 : (i + 1) / list.length; // 1 = the most recent
};
const pairRepeat = (a, b, key) => recency(a[key], b.id) + recency(b[key], a.id);
const lockedTogether = (a, b) => a.lockedWithId === b.id || b.lockedWithId === a.id;
const partnerRepeat = (a, b) => (lockedTogether(a, b) ? 0 : PARTNER_WEIGHT * pairRepeat(a, b, "partners"));

// Keeps the last `games` games of history: one partner and two opponents per doubles game.
export const trimHistory = (partners, opponents, games = HISTORY_GAMES) => ({
  partners: partners.slice(-games), opponents: opponents.slice(-2 * games),
});

// A stable pseudo-random number for a group (same group and same games played = same number), so a tie is
// broken differently from round to round but a preview shows exactly what the real pick will do.
function tieRoll(group) {
  let h = 2166136261;
  for (const p of group) for (const c of `${p.id}:${p.games || 0}|`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
// Among options of (nearly) equal cost, one chosen by tieRoll; keeps the first when there is a single best.
function pickTied(options, costOf, groupOf) {
  const costs = options.map(costOf);
  const min = Math.min(...costs);
  const tied = options.filter((_, i) => costs[i] - min < 1e-9);
  return tied[Math.floor(tieRoll(groupOf(tied[0])) * tied.length)] ?? tied[0];
}

// How often these teams have played together / against each other lately (lower is better).
function repeatCost(teamA, teamB) {
  let cost = 0;
  for (const t of [teamA, teamB]) if (t.length === 2) cost += partnerRepeat(t[0], t[1]);
  for (const a of teamA) for (const b of teamB) cost += pairRepeat(a, b, "opponents");
  return cost;
}

// Cheapest way to split a group (4: two teams of 2, honoring locks; 2: opponents), 0 for other sizes.
function groupRepeat(g) {
  if (g.length === 2) return repeatCost([g[0]], [g[1]]);
  if (g.length !== 4) return 0;
  const [a, b, c, d] = g;
  const options = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
  const apart = ([x, y]) => [...x, ...y].some((p) => partnerId(p)
    && (x.includes(p) ? y : x).some((q) => q.id === partnerId(p)));
  const ok = options.filter((o) => !apart(o));
  return Math.min(...(ok.length ? ok : options).map(([x, y]) => repeatCost(x, y)));
}

// Queue order as units: a locked pair that is waiting together (and allowed in this mode) is one unit
// at the place of whichever of them is first in line.
function toUnits(pool, mode) {
  const seen = new Set();
  const units = [];
  for (const p of pool) {
    if (seen.has(p.id)) continue;
    const mate = partnerId(p) && pool.find((x) => x.id === partnerId(p) && partnerId(x) === p.id && validLock(p, x, mode));
    seen.add(p.id);
    if (mate) { seen.add(mate.id); units.push([p, mate]); } else units.push([p]);
  }
  return units;
}

// Front of `pool` plus the best others (`need` players in all) from the next `window` units. `valid(group)` can
// veto a group (Mixed Doubles needs a man/woman balance). `against`: the group are teammates facing these
// players (challengers for winners who stay on). Returns null when there is nothing to choose between.
function pickVariety(pool, need, { valid = () => true, window = SHUFFLE_WINDOW, against = null, mode = null } = {}) {
  if (pool.length <= need) return null;
  const [front, ...rest] = toUnits(pool, mode).slice(0, window);
  const combos = [];
  const walk = (start, chosen, size) => {
    if (size === need - front.length) return combos.push(chosen);
    for (let i = start; i < rest.length; i++) if (size + rest[i].length <= need - front.length) walk(i + 1, [...chosen, i], size + rest[i].length);
  };
  walk(0, [], 0);
  const options = combos.map((idx) => ({ idx, group: [...front, ...idx.flatMap((i) => rest[i])] })).filter((o) => valid(o.group));
  if (!options.length) return null;
  const costOf = ({ idx, group }) => {
    const last = idx.length ? idx[idx.length - 1] : -1;
    let cost = against
      ? partnerRepeat(group[0], group[1]) + group.reduce((n, p) => n + against.reduce((m, o) => m + pairRepeat(p, o, "opponents"), 0), 0)
      : groupRepeat(group);
    // Every unit passed over that is ahead of the deepest pick: the longer they have waited (or the fewer
    // games they have had) than that pick, the more it costs.
    const early = (u) => u.reduce((m, p) => ((p.checkedAt || 0) < (m.checkedAt || 0) ? p : m));
    const deepest = last >= 0 ? early(rest[last]) : null;
    rest.forEach((u, i) => {
      if (idx.includes(i) || i > last) return;
      const w = early(u);
      cost += 0.5 + Math.max(0, ((deepest.checkedAt || 0) - (w.checkedAt || 0)) / 600000)
        + 2 * Math.max(0, (deepest.games || 0) - (w.games || 0));
    });
    return cost;
  };
  const best = pickTied(options, costOf, (o) => o.group);
  const ids = new Set(best.group.map((p) => p.id));
  return { taken: pool.filter((p) => ids.has(p.id)), remaining: pool.filter((p) => !ids.has(p.id)) };
}

// Groups by a shared key (skill tier, last result, ...), anchored on the first
// player in the queue whose group is big enough to fill the court. Players
// whose group is still short keep their place and wait, so one lone player at
// the front can't hold up a court while a full group sits behind them. Only
// commits if a full group is actually available — otherwise the court waits
// rather than mixing groups. If no group is big enough but the queue still has
// `need` players, the front player plus the `need - 1` closest by `distFn` (default:
// queue order) play, so a court never sits empty while many players wait. A player whose
// group stays short for STARVE_MS (needs `now`) gets that same fallback early, so they can't wait
// for ever while other groups keep rotating.
export const STARVE_MS = 15 * 60000;

function closestGroup(pool, front, need, distFn) {
  const rest = pool.filter((p) => p.id !== front.id).map((p, i) => ({ p, i, d: distFn(front, p) }))
    .sort((a, b) => a.d - b.d || a.i - b.i).slice(0, need - 1);
  const takenIds = new Set([front.id, ...rest.map((r) => r.p.id)]);
  // keep queue order inside the group
  return { taken: pool.filter((p) => takenIds.has(p.id)), remaining: pool.filter((p) => !takenIds.has(p.id)) };
}

function clusterPick(pool, keyFn, need, distFn = () => 0, now = null, shuffle = true, mode = null) {
  const sizes = new Map();
  for (const p of pool) sizes.set(keyFn(p), (sizes.get(keyFn(p)) || 0) + 1);
  if (now != null && pool.length >= need) {
    const starved = pool.find((p) => sizes.get(keyFn(p)) < need && now - (p.checkedAt || now) > STARVE_MS);
    if (starved) return closestGroup(pool, starved, need, distFn);
  }
  const anchor = pool.find((p) => sizes.get(keyFn(p)) >= need);
  if (!anchor) {
    if (pool.length < need) return { taken: [], remaining: pool };
    return closestGroup(pool, pool[0], need, distFn);
  }
  const targetKey = keyFn(anchor);
  const members = pool.filter((p) => keyFn(p) === targetKey);
  const varied = shuffle && members.length > need ? pickVariety(members, need, { mode }) : null;
  if (varied) {
    const ids = new Set(varied.taken.map((p) => p.id));
    return { taken: varied.taken, remaining: pool.filter((p) => !ids.has(p.id)) };
  }
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

export const hasGender = (p) => p?.gender === "M" || p?.gender === "F";

// Locks that the current mode can't honor between two checked-in players (so the host can be told): a
// same-gender lock in Mixed Doubles, a lock across skill levels in Skill Separated. Sorted [idA, idB] pairs.
export function ignoredLocks(players, mode) {
  const byId = new Map(players.filter((p) => p.checked).map((p) => [p.id, p]));
  const out = new Map();
  for (const p of byId.values()) {
    const q = byId.get(partnerId(p));
    if (!q) continue;
    const bad = !validLock(p, q, mode) || (mode === "Skill Separated" && skillLevelLabel(p.skill) !== skillLevelLabel(q.skill));
    if (bad) out.set([p.id, q.id].sort().join("|"), [p, q]);
  }
  return [...out.values()];
}

// Mixed Doubles teams are always one man and one woman, so a lock only counts there when it
// pairs a man with a woman. Every other mode honors any lock.
export function validLock(a, b, mode) {
  if (mode !== "Mixed Doubles") return true;
  return hasGender(a) && hasGender(b) && a.gender !== b.gender;
}

const nameOf = (p) => p?.name || "This player";

// Why a lock between a and b is refused (shown to the host), or null when it is fine.
export function lockProblem(a, b, mode) {
  if (validLock(a, b, mode)) return null;
  if (!hasGender(a)) return `${nameOf(a)} has no gender set. Set it first to lock in Mixed Doubles.`;
  if (!hasGender(b)) return `${nameOf(b)} has no gender set. Set it first to lock in Mixed Doubles.`;
  return `Mixed Doubles pairs one man and one woman, so ${nameOf(a)} and ${nameOf(b)} can't be locked together.`;
}

// Saved locks that break the Mixed Doubles rule, as sorted [idA, idB] pairs, so the host can be told.
export function mixedLockProblems(players) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const seen = new Set();
  const out = [];
  for (const p of players) {
    const partner = byId.get(partnerId(p));
    if (!partner) continue;
    const pair = [p.id, partner.id].sort();
    const key = pair.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    if (!validLock(p, partner, "Mixed Doubles")) out.push(pair);
  }
  return out;
}

// Manual moves in Mixed Doubles: may this player join a team already holding `teamPlayers`?
export function mixedTeamAccepts(player, teamPlayers) {
  if (!hasGender(player)) return { ok: false, reason: `${nameOf(player)} has no gender set. Set it first to play Mixed Doubles.` };
  if (teamPlayers.some((x) => x.gender === player.gender)) {
    return { ok: false, reason: `That would put two ${player.gender === "M" ? "men" : "women"} on one team. Mixed Doubles teams are one man and one woman.` };
  }
  return { ok: true };
}

// Which side ("A" / "B") of a court takes this player in Mixed Doubles, or null if neither can.
export function mixedSideFor(player, teamA, teamB) {
  if (!hasGender(player)) return null;
  for (const [side, team] of [["A", teamA], ["B", teamB]]) {
    if (team.length < 2 && mixedTeamAccepts(player, team).ok) return side;
  }
  return null;
}

// Whether winners stay on the court after this result: the club's "winners stay" setting, or
// always in Winners / Losers, until they have won `maxWinStreak` in a row (then they rest).
export function shouldWinnersStay({ rules, mode, streak, winners }) {
  return winners.length > 0 && (Boolean(rules.winnersStay) || mode === "Winners / Losers") && streak < rules.maxWinStreak;
}

// If a picked player's locked partner is still sitting in what's left over
// (checked in, not already playing), pulls the partner in too — bumping out
// whichever other picked player isn't itself completing a lock. This is what
// makes a locked duo travel together: as soon as either of them reaches the
// front of the queue, both come in, and splitTeams keeps them on one side.
// Doubles-only (need === 4) — singles pits opponents 1v1, so there's no
// "teammate" slot for a lock to fill.
// `fixed` are players already seated on the court (not bumpable): their waiting partner is pulled in too.
function enforceLockedPairs(taken, remaining, mode, fixed = []) {
  const working = [...taken];
  const pool = [...remaining];
  const genderLocked = mode === "Mixed Doubles";
  const seatedIn = (id) => working.some((x) => x.id === id) || fixed.some((x) => x.id === id);
  for (const original of [...fixed, ...taken]) {
    const p = fixed.find((x) => x.id === original.id) || working.find((x) => x.id === original.id);
    if (!p) continue;
    const pid = partnerId(p);
    if (!pid || seatedIn(pid)) continue;
    const poolIdx = pool.findIndex((x) => x.id === pid);
    if (poolIdx === -1) continue; // partner not available this round
    const incoming = pool[poolIdx];
    if (!validLock(p, incoming, mode)) continue; // Mixed Doubles ignores a same-gender lock
    // Skill Separated keeps one skill level per match, so a lock across levels is left alone.
    if (mode === "Skill Separated" && skillLevelLabel(p.skill) !== skillLevelLabel(incoming.skill)) continue;
    let bumpIdx = -1;
    for (let i = working.length - 1; i >= 0; i--) {
      if (working[i].id === p.id) continue;
      if (genderLocked && working[i].gender !== incoming.gender) continue; // keep the M/F count balanced
      const otherPid = partnerId(working[i]);
      if (otherPid && seatedIn(otherPid)) continue; // don't break another satisfied lock
      bumpIdx = i;
      break;
    }
    if (bumpIdx === -1) continue; // no safe seat to free up
    const bumped = working[bumpIdx];
    working[bumpIdx] = incoming;
    pool.splice(poolIdx, 1);
    pool.unshift(bumped); // the bumped player keeps the front of the line
  }
  return { taken: working, remaining: pool };
}

// Picks the next `need` players for a court, respecting an explicit
// court-level restriction first, then falling back to the session's mode.
export function selectForCourt({ pool, court, mode, need, now = null, shuffle = true }) {
  // Custom: the host builds every match, so nothing is picked automatically.
  if (mode === "Custom") return { taken: [], remaining: pool };
  const levelRestricted = Boolean(court?.level && court.level !== "Any Level");
  let result;
  if (levelRestricted) {
    result = pickForLevel(pool, court.level, need);
  } else if (mode === "Skill Separated") {
    result = clusterPick(pool, (p) => skillLevelLabel(p.skill), need, (a, b) => Math.abs((a.skill || 0) - (b.skill || 0)), now, shuffle, mode);
  } else if (mode === "Winners / Losers") {
    result = clusterPick(pool, (p) => p.lastResult || "new", need, undefined, now, shuffle, mode);
  } else if (mode === "Mixed Doubles" && need % 2 === 0) {
    const half = need / 2;
    const balanced = (g) => g.filter((p) => p.gender === "M").length === half && g.filter((p) => p.gender === "F").length === half;
    const varied = shuffle ? pickVariety(pool.filter(hasGender), need, { valid: balanced, window: 2 * SHUFFLE_WINDOW, mode }) : null;
    if (varied) {
      const m = varied.taken.filter((p) => p.gender === "M"), f = varied.taken.filter((p) => p.gender === "F");
      const ids = new Set(varied.taken.map((p) => p.id));
      result = { taken: m.flatMap((x, i) => [x, f[i]]), remaining: pool.filter((p) => !ids.has(p.id)) };
    } else result = mixedDoublesPick(pool, need);
  } else if (pool.length < need) {
    result = { taken: [], remaining: pool };
  } else {
    result = (shuffle && pickVariety(pool, need, { mode })) || { taken: pool.slice(0, need), remaining: pool.slice(need) };
  }
  // A level-restricted court stays reserved for that level even if it means
  // splitting up a locked duo of different skill tiers.
  if (!levelRestricted && need === 4 && result.taken.length === need) {
    return enforceLockedPairs(result.taken, result.remaining, mode);
  }
  return result;
}

// Picks who joins a court that already has players: the challengers when winners stay on, or
// whoever tops up an open seat. An explicit court level still wins. Otherwise:
// - Custom: nobody (the host adds players).
// - Skill Separated keeps them to the seated players' level.
// - Mixed Doubles brings the missing genders so every team ends up one man and one woman
//   (men first, then women; the caller seats each on the side that needs them).
// - Winners / Losers takes recent winners first, then the next in the queue.
// - Every other mode takes the next in the queue.
function pickToJoin({ pool, court, seated, mode, need }) {
  if (mode === "Custom") return { taken: [], remaining: pool };
  const levelRestricted = Boolean(court?.level && court.level !== "Any Level");
  if (!levelRestricted && mode === "Skill Separated" && seated.length) {
    return pickForLevel(pool, skillLevelLabel(seated[0].skill), need);
  }
  if (!levelRestricted && mode === "Mixed Doubles" && seated.length > 0 && seated.length + need === 4) {
    const count = (g) => seated.filter((x) => x.gender === g).length;
    const needM = Math.max(0, 2 - count("M"));
    const needF = Math.max(0, 2 - count("F"));
    if (needM + needF === need) {
      const males = pool.filter((x) => x.gender === "M").slice(0, needM);
      const females = pool.filter((x) => x.gender === "F").slice(0, needF);
      if (males.length < needM || females.length < needF) return { taken: [], remaining: pool };
      const taken = [...males, ...females];
      const takenIds = new Set(taken.map((x) => x.id));
      return { taken, remaining: pool.filter((x) => !takenIds.has(x.id)) };
    }
  }
  if (!levelRestricted && mode === "Winners / Losers") {
    if (pool.length < need) return { taken: [], remaining: pool };
    const ordered = [...pool.filter((x) => x.lastResult === "win"), ...pool.filter((x) => x.lastResult !== "win")];
    const taken = ordered.slice(0, need);
    const takenIds = new Set(taken.map((x) => x.id));
    return { taken, remaining: pool.filter((x) => !takenIds.has(x.id)) };
  }
  if (!levelRestricted && need === 2 && seated.length === 2) {
    const varied = pickVariety(pool, 2, { against: seated, mode });
    if (varied) return varied;
  }
  return selectForCourt({ pool, court, mode: null, need, shuffle: false });
}

// The same pick, then a locked partner of a seated or picked player is pulled in (as in selectForCourt),
// so topping up a court can't split a lock. `pullSeatedPartners: false` when the seated side is fixed
// and the picks go to the other team (winners staying on). It can also be a list: only those seated players
// get their waiting partner pulled in (topping up a court: a seated player on a full team has no seat beside them).
export function selectToJoin({ pool, court, seated, mode, need, pullSeatedPartners = true }) {
  const result = pickToJoin({ pool, court, seated, mode, need });
  const levelRestricted = Boolean(court?.level && court.level !== "Any Level");
  if (levelRestricted || result.taken.length !== need) return result;
  return enforceLockedPairs(result.taken, result.remaining, mode,
    Array.isArray(pullSeatedPartners) ? pullSeatedPartners : pullSeatedPartners ? seated : []);
}

// Seats joiners on a court: beside a locked partner already there, a locked pair together on a team
// with room for both, then everyone else on the first team with room (`sideFor(p, teamA, teamB)`
// returns "A" / "B" / null, used by Mixed Doubles). `need` is the whole court (2 or 4). Returns [teamA, teamB] ids.
export function seatJoiners(teamA, teamB, joiners, need, sideFor) {
  const cap = need / 2;
  const A = [...teamA], B = [...teamB];
  const placed = new Set();
  const put = (p, team) => { team.push(p.id); placed.add(p.id); };
  for (const p of joiners) {
    const pid = p.lockedWithId;
    if (A.includes(pid) && A.length < cap) put(p, A);
    else if (B.includes(pid) && B.length < cap) put(p, B);
  }
  for (const p of joiners) {
    if (placed.has(p.id)) continue;
    const mate = joiners.find((x) => x.id === p.lockedWithId && !placed.has(x.id));
    const team = mate && [A, B].find((t) => cap - t.length >= 2);
    if (team) { put(p, team); put(mate, team); }
  }
  for (const p of joiners) {
    if (placed.has(p.id)) continue;
    const side = sideFor ? sideFor(p, A, B) : null;
    put(p, side ? (side === "A" ? A : B) : A.length < cap ? A : B);
  }
  return [A, B];
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

// Win rate of a player, only once there are enough results to mean something (3 games), else neutral.
// Scaled by how many games back it up, so one lucky night doesn't outweigh the star rating.
const WIN_RATE_MIN_GAMES = 3;
const winRate = (p) => {
  const g = p.games || 0;
  if (g < WIN_RATE_MIN_GAMES) return 0.5;
  const conf = Math.min(g, 8) / 8;
  return 0.5 + ((p.wins || 0) / g - 0.5) * conf;
};
const teamWinRate = (team) => winRate(team[0]) + winRate(team[1]);

// For a full doubles group, tries all 3 ways to split the 4 selected players
// into two teams of 2. Any split that would put locked partners on opposite
// teams is discarded first. Among what's left:
// - Balanced picks the split whose team star totals are closest (strongest +
//   weakest vs the middle two, e.g. 3★+2★ vs 3★+2★); among equally balanced splits the fewest
//   repeat partners / opponents and the most even win rates, then a stable pseudo-random choice.
// - Any other mode with `avoidRepeats` on picks fewest recent repeat partners / opponents.
// - Otherwise the first (front/back) split.
// Mixed Doubles only chooses between the pairings that keep each team one M + one F.
// Non-doubles groups just split front/back.
export function splitTeams(taken, mode, avoidRepeats = false) {
  if (taken.length === 4) {
    const [a, b, c, d] = taken;
    const options = [[[a, b], [c, d]], [[a, c], [b, d]], [[a, d], [b, c]]];
    const keepsLocksTogether = ([teamA, teamB]) => {
      const splits = (from, to) => from.some((x) => partnerId(x) && to.some((y) => y.id === partnerId(x) && validLock(x, y, mode)));
      return !splits(teamA, teamB) && !splits(teamB, teamA);
    };
    const mixedTeams = (team) => hasGender(team[0]) && hasGender(team[1]) && team[0].gender !== team[1].gender;
    const valid = options.filter(keepsLocksTogether);
    let candidates = valid.length ? valid : options;
    // Mixed Doubles: every team is one man and one woman whenever the group allows it.
    if (mode === "Mixed Doubles") {
      const mixed = candidates.filter(([teamA, teamB]) => mixedTeams(teamA) && mixedTeams(teamB));
      if (mixed.length) candidates = mixed;
    }
    const balanced = mode === "Balanced";
    if (balanced || avoidRepeats) {
      const stars = balanced ? balanceStars(taken) : null;
      const teamStars = (team) => stars.get(team[0].id) + stars.get(team[1].id);
      // Star balance decides first (rounded so an averaged unrated rating can't break a real tie with float
      // noise). Only among splits equally balanced on stars do repeats and win rates count, together.
      const scored = candidates.map(([teamA, teamB]) => ({
        teams: [teamA, teamB],
        gap: balanced ? Math.round(Math.abs(teamStars(teamA) - teamStars(teamB)) * 1000) : 0,
        // Repeat partners / opponents, plus how unevenly the teams' win rates split (0 to 2, only when known).
        rest: repeatCost(teamA, teamB) + (balanced ? Math.abs(teamWinRate(teamA) - teamWinRate(teamB)) : 0),
      }));
      const bestGap = Math.min(...scored.map((x) => x.gap));
      const level = scored.filter((x) => x.gap === bestGap);
      const best = pickTied(level, (x) => x.rest, (x) => taken.length ? [...x.teams[0], ...x.teams[1]] : []);
      return [best.teams[0].map((p) => p.id), best.teams[1].map((p) => p.id)];
    }
    const [teamA, teamB] = candidates[0];
    return [teamA.map((p) => p.id), teamB.map((p) => p.id)];
  }
  const half = Math.ceil(taken.length / 2);
  return [taken.slice(0, half).map((p) => p.id), taken.slice(half).map((p) => p.id)];
}
