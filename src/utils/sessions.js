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

// A walk-in ("Play now") is never listed, so it is never public, whatever the club is.
export const metaFor = (event, meta) => (event.walkIn ? { ...meta, clubPublic: false } : meta);

// True when an event's copy differs from the club (a missing field differs, so old events get repaired).
export const needsSync = (event, meta) => {
  const want = metaFor(event, meta);
  return Object.keys(want).some((k) => event[k] !== want[k]);
};

// Events are writable by every club manager, and the query also returns whatever else is stored under an `events`
// collection, so nothing is trusted: a bad shape is dropped here instead of crashing a screen later.
const optional = (v, type) => v === undefined || typeof v === type;
function zoneOk(zone) {
  if (zone === undefined) return true;
  try { new Intl.DateTimeFormat("en-US", { timeZone: zone }); return typeof zone === "string"; } catch { return false; }
}
export const validSession = (e) => Boolean(e) && typeof e === "object"
  && typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date)
  && typeof e.startTime === "string" && /^\d{2}:\d{2}$/.test(e.startTime)
  && optional(e.durationMins, "number") && optional(e.fee, "number") && optional(e.maxPlayers, "number")
  && optional(e.title, "string") && optional(e.level, "string") && optional(e.clubName, "string") && optional(e.clubLocation, "string")
  && (e.attendees === undefined || Array.isArray(e.attendees)) && zoneOk(e.timeZone);

// The query's lower bound: yesterday in UTC, so no time zone is cut off. Exact filtering is listedSessions.
export const queryFromDate = (now = new Date()) => new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

// Well formed, not a walk-in, not ended, and its scheduled time not past in its own zone (the same rule as the club's
// public booking page, so a card never leads to a page that doesn't list it; a live game shows while it is within its time). Soonest first.
export const listedSessions = (events, now = new Date()) =>
  events
    .filter((e) => validSession(e) && !e.walkIn && e.status !== "ended" && !hasEnded(e, nowIn(e.timeZone || FALLBACK_ZONE, now)))
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

// "any", then today and tomorrow (always) and up to four more days that have sessions, in date order. A day before today
// still gets its chip: a club's own date can be behind the viewer's (a club in Hawaii while the viewer is in Manila).
export function dateChips(events, today) {
  const tomorrow = addDay(today);
  const more = [...new Set(events.map((e) => e.date))].filter((d) => d !== today && d !== tomorrow).sort().slice(0, 4);
  return ["any", ...[today, tomorrow, ...more].sort()];
}

export function filterSessions(events, text, date) {
  const q = (text || "").trim().toLowerCase();
  return events.filter((e) => (date === "any" || e.date === date)
    && (!q || [e.clubName, e.clubLocation, e.title, e.level].some((v) => (v || "").toLowerCase().includes(q))));
}

// A group heading: "Today, Fri, Oct 9". The chip label is shorter.
export const dayHeading = (date, today) => (date === today ? `Today, ${formatDay(date)}` : date === addDay(today) ? `Tomorrow, ${formatDay(date)}` : formatDay(date));
export const chipLabel = (date, today) => (date === "any" ? "Any day" : date === today ? "Today" : date === addDay(today) ? "Tomorrow" : formatDay(date));
