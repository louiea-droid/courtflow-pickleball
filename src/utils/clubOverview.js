// The club Overview: which game is live or next, what comes after it, and this month's numbers.
// Pure; checked by clubOverview.check.mjs.
import { byStart, isOver, splitAttendees } from "./bookings.js";

export function overviewGames(events, fallbackZone) {
  const current = events.filter((e) => !isOver(e, fallbackZone)).sort(byStart);
  const waiting = current.filter((e) => e.status !== "live");
  return { live: current.filter((e) => e.status === "live"), next: waiting[0] || null, coming: waiting.slice(1, 4) };
}

// Games dated this month (walk-ins too) and the seats booked in them.
export function monthStats(events, todayYmd) {
  const month = todayYmd.slice(0, 7);
  const inMonth = events.filter((e) => (e.date || "").startsWith(month));
  return { games: inMonth.length, players: inMonth.reduce((n, e) => n + splitAttendees(e).confirmed.length, 0) };
}

export function fillLine(e) {
  if (e.walkIn) return "Walk-in";
  const { confirmed, waitlist } = splitAttendees(e);
  if (!e.maxPlayers) return `${confirmed.length} booked`; // no seat limit set
  const left = (e.maxPlayers || 0) - confirmed.length;
  if (left <= 0) return waitlist.length ? `Full · ${waitlist.length} waiting` : "Full";
  return `${confirmed.length} of ${e.maxPlayers} booked · ${left} spot${left === 1 ? "" : "s"} left`;
}
