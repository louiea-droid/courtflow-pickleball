// How many matches the players' game counts add up to. Every player in a match logs one
// game, so a doubles match adds four and a singles match two.
export const matchCount = (players, format) => {
  const games = players.reduce((n, p) => n + (p.games || 0), 0);
  return Math.round(games / (format === "Singles" ? 2 : 4));
};
