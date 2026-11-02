// Where a person stands in a live game, for the Home card. Pure: no Firestore (the hook reads the data).
// The line is the queue app's order (longest wait first, then fewest games); the next match on each court is the
// app's own pick (see queueStatus). Later rounds can still shift, so the wait is an estimate and the screens say "about".
import { nextMatchOf, upNextPlan } from "./rotationModes.js";

export const DEFAULT_GAME_MINUTES = 15;

const onCourt = (c) => [...(c.teamA || []), ...(c.teamB || [])];

// Checked-in players who are not on a court, in the order they will be picked: whoever has waited longest
// (since checking in or since their last game ended) first, then fewest games, then id.
export function queueOrder(players, courts) {
  const playing = new Set(courts.flatMap(onCourt));
  return players
    .filter((p) => p.checked && !playing.has(p.id))
    .sort((a, b) => (a.checkedAt || 0) - (b.checkedAt || 0) || (a.games || 0) - (b.games || 0) || (a.id < b.id ? -1 : 1));
}

// null when the person isn't a checked-in player of this game; { state: "playing", court }; or
// { state: "waiting", position, ahead, waitMins, upNext, nextOn, nextMatch }. With a `mode`, the next matches are
// the queue app's own pick (upNextPlan: shuffle, levels, locks, Mixed Doubles): `nextOn` is the court number the
// person is already picked for when it is known (an open court, or a court set to a level), `nextMatch` their place
// in the shared line otherwise (1: the next court to finish). Without a mode (or in Custom) plain queue order.
export function queueStatus({ players, courts, uid, format, mode, gameMinutes = DEFAULT_GAME_MINUTES, now = null }) {
  const mine = uid ? players.find((p) => p.uid === uid && p.checked) : null;
  if (!mine) return null;
  const court = courts.find((c) => onCourt(c).includes(mine.id));
  if (court) return { state: "playing", court: court.courtNumber };
  const perCourt = format === "Singles" ? 2 : 4;
  const queue = queueOrder(players, courts);
  const position = queue.findIndex((p) => p.id === mine.id) + 1;
  const base = { state: "waiting", position, ahead: position - 1 };
  // Games on the busy courts end about half a game from now on average; each later round is a full game.
  const mins = (rounds) => Math.round(((rounds - 0.5) * gameMinutes) / 5) * 5;
  const free = courts.filter((c) => onCourt(c).length === 0);
  if (mode && mode !== "Custom" && courts.length) {
    const plan = upNextPlan({ pool: queue, courts, mode, need: perCourt, now });
    const next = nextMatchOf(plan, courts)[mine.id];
    const mineOn = next?.court;
    if (mineOn && free.includes(mineOn)) return { ...base, waitMins: 0, upNext: true, nextOn: mineOn.courtNumber };
    if (mineOn) return { ...base, waitMins: mins(1), upNext: false, nextOn: mineOn.courtNumber };
    // One line match per Any Level court, so every one of them goes on within the first round.
    if (next) return { ...base, waitMins: mins(1), upNext: false, nextOn: null, nextMatch: next.match };
    // Not picked yet: the people still waiting after this round's picks go in queue order.
    const picked = new Set([...plan.line, ...Object.values(plan.own)].flat().map((p) => p.id));
    const rest = queue.filter((p) => !picked.has(p.id));
    const busyPicked = plan.line.slice(plan.openFor.length).some((g) => g.length)
      || courts.some((c) => !free.includes(c) && plan.own[c.id]?.length);
    const rounds = (busyPicked ? 1 : 0) + Math.ceil((rest.findIndex((p) => p.id === mine.id) + 1) / (courts.length * perCourt));
    return { ...base, waitMins: mins(rounds), upNext: false, nextOn: null };
  }
  if (courts.length === 0 || position <= free.length * perCourt) {
    return { ...base, waitMins: 0, upNext: true, nextOn: null };
  }
  const rounds = Math.ceil((position - free.length * perCourt) / (courts.length * perCourt));
  return { ...base, waitMins: mins(rounds), upNext: false, nextOn: null };
}
