// The live score of one court's match (docs/superpowers/specs/2026-10-13-umpire-scoring-design.md). Pure: every
// function returns a new score. Team 1 is court.teamA, team 2 is court.teamB. The score lives on the court doc and
// only counts while score.start equals the court's start, so a new match on the court never shows an old score.
export const SCORE_TARGETS = [11, 15, 21];
const LOG_MAX = 50;
const other = (team) => (team === 1 ? 2 : 1);
const key = (team) => (team === 1 ? "t1" : "t2");

// Side-out doubles starts 0-0-2: the first serving team gets one server. Team 1 serves first (see firstServe).
export function newScore({ start, style = "sideout", to = 11, singles = false }) {
  return { start, t1: 0, t2: 0, serving: 1, server: style === "sideout" && !singles ? 2 : null, style, to, singles, log: [] };
}

export function liveScore(court, { style, to, singles } = {}) {
  const s = court.score;
  return s && s.start === court.start && Array.isArray(s.log) ? s : newScore({ start: court.start, style, to, singles });
}

const snap = (s) => ({ t1: s.t1, t2: s.t2, serving: s.serving, server: s.server });
// Any change after a confirmation makes the game unconfirmed again.
const push = ({ confirmed, ...s }, next) => ({ ...s, ...next, log: [...s.log, snap(s)].slice(-LOG_MAX) });

export function winner(s) {
  return Math.max(s.t1, s.t2) >= s.to && Math.abs(s.t1 - s.t2) >= 2 ? (s.t1 > s.t2 ? 1 : 2) : 0;
}

// The team that wins the game with the next point (side-out: only the serving team scores), else 0.
export function gamePoint(s) {
  if (winner(s)) return 0;
  const wins = (t) => {
    const mine = s[key(t)] + 1;
    return mine >= s.to && mine - s[key(other(t))] >= 2;
  };
  return (s.style === "rally" ? [1, 2] : [s.serving]).find(wins) || 0;
}

// The team that won the rally. Rally: it scores and serves. Side-out: only the serving team scores; the other team
// winning moves the serve (server 1 -> 2, then side out; singles: straight to a side out).
export function rally(s, team) {
  if (winner(s)) return s;
  if (s.style === "rally") return push(s, { [key(team)]: s[key(team)] + 1, serving: team });
  if (team === s.serving) return push(s, { [key(team)]: s[key(team)] + 1 });
  if (s.singles) return push(s, { serving: other(s.serving) });
  return s.server === 2 ? push(s, { serving: other(s.serving), server: 1 }) : push(s, { server: 2 });
}

export function adjust(s, team, delta) {
  const next = Math.max(0, s[key(team)] + delta);
  return next === s[key(team)] ? s : push(s, { [key(team)]: next });
}

export function undo(s) {
  const prev = s.log[s.log.length - 1];
  if (!prev) return s;
  const { confirmed, ...rest } = s;
  return { ...rest, ...prev, log: s.log.slice(0, -1) };
}

// The umpire says a finished game is final. `at` (a time) tells one confirmation from a later one after an undo.
export const confirmScore = (s, at = Date.now()) => (winner(s) ? { ...s, confirmed: at } : s);

// Who serves first, only before the first rally.
export const firstServe = (s, team) => (s.log.length === 0 && s.t1 + s.t2 === 0 ? { ...s, serving: team } : s);

// The spoken score: serving team first, then the receiver, then the server number ("4 - 2 - 1").
export function call(s) {
  if (s.style === "rally") return `${s.t1} - ${s.t2}`;
  const mine = s.serving === 1 ? s.t1 : s.t2;
  const theirs = s.serving === 1 ? s.t2 : s.t1;
  return s.singles ? `${mine} - ${theirs}` : `${mine} - ${theirs} - ${s.server}`;
}

// "11-7": the winner's points first, for the match log.
export const finalText = (s) => `${Math.max(s.t1, s.t2)}-${Math.min(s.t1, s.t2)}`;

// What the last tap did, in words ("Point to Team 2 (8-9)", "Side out: Team 1 now serves"); null before the first one.
// A +1 for the serving team reads as a point either way (a fix and a point look the same, and mean the same).
export function lastEvent(s) {
  const prev = s.log[s.log.length - 1];
  if (!prev) return null;
  const now = `(${s.t1}-${s.t2})`;
  const up = [1, 2].find((t) => s[key(t)] - prev[key(t)] === 1 && s[key(other(t))] === prev[key(other(t))]);
  if (up && s.serving === up && (s.style === "rally" || prev.serving === up)) return `Point to Team ${up} ${now}`;
  if (s.t1 !== prev.t1 || s.t2 !== prev.t2) return `Score fixed ${now}`;
  if (s.serving !== prev.serving) return `Side out: Team ${s.serving} now serves`;
  if (s.server !== prev.server) return `Second server for Team ${s.serving}`;
  return null;
}
