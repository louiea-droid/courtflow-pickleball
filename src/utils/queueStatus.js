// Where a person stands in a live game, for the Home card. Pure: no Firestore (the hook reads the data).
// The order is the queue app's default (fewest games, then earliest check-in); Winners / Losers, Custom and
// Mixed Doubles pick by other rules, so the number is an estimate and the screens say "about".
export const DEFAULT_GAME_MINUTES = 15;

const onCourt = (c) => [...(c.teamA || []), ...(c.teamB || [])];

// Checked-in players who are not on a court, in the order they will be picked.
export function queueOrder(players, courts) {
  const playing = new Set(courts.flatMap(onCourt));
  return players
    .filter((p) => p.checked && !playing.has(p.id))
    .sort((a, b) => a.games - b.games || a.checkedAt - b.checkedAt || (a.id < b.id ? -1 : 1));
}

// null when the person isn't a checked-in player of this game; { state: "playing", court }; or
// { state: "waiting", position, ahead, waitMins, upNext }.
export function queueStatus({ players, courts, uid, format, gameMinutes = DEFAULT_GAME_MINUTES }) {
  const mine = uid ? players.find((p) => p.uid === uid && p.checked) : null;
  if (!mine) return null;
  const court = courts.find((c) => onCourt(c).includes(mine.id));
  if (court) return { state: "playing", court: court.courtNumber };
  const perCourt = format === "Singles" ? 2 : 4;
  const position = queueOrder(players, courts).findIndex((p) => p.id === mine.id) + 1;
  const free = courts.filter((c) => onCourt(c).length === 0).length;
  if (courts.length === 0 || position <= free * perCourt) {
    return { state: "waiting", position, ahead: position - 1, waitMins: 0, upNext: true };
  }
  // Games on the busy courts end about half a game from now on average; each later round is a full game.
  const rounds = Math.ceil((position - free * perCourt) / (courts.length * perCourt));
  const waitMins = Math.round(((rounds - 0.5) * gameMinutes) / 5) * 5;
  return { state: "waiting", position, ahead: position - 1, waitMins, upNext: false };
}
