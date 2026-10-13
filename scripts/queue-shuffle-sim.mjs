// Social-shuffle simulation: node scripts/queue-shuffle-sim.mjs
// Courts finish one at a time in a pseudo-random order (like a real night), finishers go to the back of
// the queue, and the freed court is refilled the way QueueApp.recordWin does. Compares the old queue-order
// pick (shuffle off) with the new one, on repeats AND on how long anyone waits.
import { selectForCourt, splitTeams, trimHistory } from "../src/utils/rotationModes.js";

function run({ N, courts, mode, shuffle, locks = 0, matches = 120, seed = 7 }) {
  let rnd = seed; const rand = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
  let tick = 0;
  const players = Array.from({ length: N }, (_, i) => ({
    id: "p" + i, skill: [3, 3, 4, 2][i % 4], games: 0, checkedAt: ++tick, partners: [], opponents: [],
    gender: i % 2 ? "F" : "M", lastPlay: 0,
  }));
  for (let k = 0; k < locks; k++) { players[2 * k].lockedWithId = players[2 * k + 1].id; players[2 * k + 1].lockedWithId = players[2 * k].id; }
  const byId = (id) => players.find((p) => p.id === id);
  const onCourt = new Set();
  const live = [];
  const seenFour = new Map(); let sameFour = 0, partnerRepeat = 0, oppRepeat = 0, maxWait = 0, total = 0;
  const waitSum = []; // ticks between a player's games

  const fill = () => {
    const queue = players.filter((p) => !onCourt.has(p.id)).sort((a, b) => a.games - b.games || a.checkedAt - b.checkedAt);
    const { taken } = selectForCourt({ pool: queue, court: {}, mode, need: 4, shuffle });
    if (taken.length < 4) return null;
    const [A, B] = splitTeams(taken, mode, true);
    [...A, ...B].forEach((id) => onCourt.add(id));
    const key = [...A, ...B].sort().join();
    seenFour.set(key, (seenFour.get(key) || 0) + 1);
    if (seenFour.get(key) > 1) sameFour++;
    // history BEFORE this match is what the pick saw; count repeats against the last 5 partners / 8 opponents
    for (const t of [A, B]) { if (byId(t[0]).partners.slice(-5).includes(t[1]) && !byId(t[0]).lockedWithId) partnerRepeat++; }
    for (const a of A) for (const b of B) if (byId(a).opponents.slice(-8).includes(b)) oppRepeat++;
    total++;
    for (const id of [...A, ...B]) { const p = byId(id); maxWait = Math.max(maxWait, tick - p.lastPlay); waitSum.push(tick - p.lastPlay); p.lastPlay = tick; }
    return { A, B };
  };
  for (let c = 0; c < courts; c++) live.push(fill());
  for (let m = 0; m < matches; m++) {
    tick++;
    const i = Math.floor(rand() * live.length);
    const { A, B } = live[i];
    // result: team A wins; update history like recordWin
    for (const [team, other] of [[A, B], [B, A]]) for (const id of team) {
      const p = byId(id);
      p.games++; p.checkedAt = ++tick;
      ({ partners: p.partners, opponents: p.opponents } = trimHistory([...p.partners, team.find((x) => x !== id)], [...p.opponents, ...other]));
      onCourt.delete(id);
    }
    live[i] = fill() || live[i];
  }
  const avg = waitSum.reduce((a, b) => a + b, 0) / waitSum.length;
  return { sameFour, partnerRepeat, oppRepeat, matches: total, maxWait, avgWait: avg };
}

const cases = [[12, 3, "Balanced"], [16, 3, "Balanced"], [14, 3, "Balanced"], [20, 4, "Balanced"], [20, 4, "Skill Separated"], [14, 3, "Mixed Doubles"],
  [20, 4, "Balanced", 2], [20, 4, "Balanced", 5], [20, 4, "Balanced", 10]]; // last three: 2 / 5 / 10 locked pairs
console.log("(partner repeats do not count locked pairs: they cannot change partners)");
for (const [N, courts, mode, locks = 0] of cases) {
  const a = run({ N, courts, mode, shuffle: false, locks }), b = run({ N, courts, mode, shuffle: true, locks });
  const f = (r) => `same-4 ${String(r.sameFour).padStart(3)} | partner repeats ${String(r.partnerRepeat).padStart(3)} | opponent repeats ${String(r.oppRepeat).padStart(3)} | longest wait ${String(r.maxWait).padStart(3)} | avg ${r.avgWait.toFixed(1)}`;
  console.log(`${N} players, ${courts} courts, ${mode}${locks ? `, ${locks} locked pairs` : ""}  (${a.matches} matches)\n   old: ${f(a)}\n   new: ${f(b)}`);
}
