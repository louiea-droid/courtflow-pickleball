// Pure rules for Find session: the copy of a club that each event carries, what counts as a listed session, and how the
// finder groups, filters and labels them. No Firestore here (that is useSessions / useSessionSync), so all of it is
// covered by sessions.check.mjs.
import { byStart, hasEnded, nowIn, splitAttendees } from "./bookings.js";
import { formatDay } from "./format.js";

const FALLBACK_ZONE = "Asia/Manila";

// What every event carries about its club. clubPublic is what the collection-group query filters on (rules can't look a
// club up inside a query); the rest lets a card name and link its club without another read.
export const sessionMeta = (clubId, club) => ({
  clubPublic: club.visibility === "public",
  clubId,
  clubName: club.name,
  clubLocation: club.location || "",
});

// True when an event's copy differs from the club (a missing field differs, so old events get repaired).
export const needsSync = (event, meta) => Object.keys(meta).some((k) => event[k] !== meta[k]);

// The query's lower bound: yesterday in UTC, so no time zone is cut off. Exact filtering is listedSessions.
export const queryFromDate = (now = new Date()) => new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

// Not a walk-in, not ended, and its scheduled time not past in its own zone; a live game stays listed. Soonest first.
export const listedSessions = (events, now = new Date()) =>
  events
    .filter((e) => !e.walkIn && e.status !== "ended" && (e.status === "live" || !hasEnded(e, nowIn(e.timeZone || FALLBACK_ZONE, now))))
    .sort(byStart);

export function spotsLabel(event) {
  if (!event.maxPlayers) return "Open";
  const left = event.maxPlayers - splitAttendees(event).confirmed.length;
  return left <= 0 ? "Full, waitlist open" : left === 1 ? "1 spot left" : `${left} spots left`;
}

export function groupByDate(events) {
  const groups = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.events.push(e);
    else groups.push({ date: e.date, events: [e] });
  }
  return groups;
}

const addDay = (ymd) => new Date(Date.parse(`${ymd}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

// "any", today, tomorrow (always), then up to five more days that have sessions.
export function dateChips(events, today) {
  const tomorrow = addDay(today);
  const more = [...new Set(events.map((e) => e.date))].filter((d) => d > tomorrow).sort().slice(0, 5);
  return ["any", today, tomorrow, ...more];
}

export function filterSessions(events, text, date) {
  const q = (text || "").trim().toLowerCase();
  return events.filter((e) => (date === "any" || e.date === date)
    && (!q || [e.clubName, e.clubLocation, e.title, e.level].some((v) => (v || "").toLowerCase().includes(q))));
}

export const dayHeading = (date, today) => (date === today ? "Today" : date === addDay(today) ? "Tomorrow" : formatDay(date));
