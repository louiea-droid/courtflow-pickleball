// A signed-in person's open play bookings, kept on their account (accounts/{uid}/bookings/{requestId}) so Home and
// the bell can show them on any device. The request id is the doc id: it is the key that reads the private request.
// Pure: the hooks read Firestore.
import { hasEnded, myStatus, nowIn } from "./bookings.js";

// The copy saved on the account. Title, date and time are only for sorting and dropping old ones;
// what Home shows comes from the live event.
// ponytail: a date the host moves later isn't copied back; the live event still shows the right one.
export const bookingCopy = ({ clubId, clubName, event, seatId, at }) => ({
  clubId, eventId: event.id, seatId, clubName: clubName || event.clubName || event.hostName || "",
  title: event.title || "Open play", date: event.date, startTime: event.startTime, bookedAt: at,
});

// Copies worth listening to: from yesterday on (UTC; the zone check comes later), the soonest `max`.
export function recentCopies(copies, today, max = 10) {
  const from = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
  return copies.filter((c) => c.date >= from)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, max);
}

// Minutes from now until the event starts on its own wall clock, or null when it isn't today there.
export function minutesUntil(event, at = new Date()) {
  const now = nowIn(event.timeZone, at);
  if (event.date !== now.date) return null;
  const mins = (hm) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
  return mins(event.startTime) - mins(now.hm);
}

export const SOON_MINS = 60;

// One row per booking whose event still exists and hasn't ended. events / requests: { [requestId]: data }
// (a request is `null` while it loads, "gone" when deleted).
export function bookingRows(copies, events, requests, at = new Date()) {
  return copies.flatMap((c) => {
    const event = events[c.id];
    if (!event || event.status === "ended" || hasEnded(event, nowIn(event.timeZone, at))) return [];
    const req = requests[c.id];
    const status = myStatus(event, c.seatId, req === "gone" ? "approved" : req?.status);
    const until = minutesUntil(event, at);
    return [{
      id: c.id, clubId: c.clubId, eventId: c.eventId, clubName: c.clubName,
      title: event.title || "Open play", date: event.date, startTime: event.startTime, durationMins: event.durationMins,
      live: event.status === "live", status,
      soon: status.key === "confirmed" && until !== null && until >= 0 && until <= SOON_MINS,
      to: `/open-play?club=${encodeURIComponent(c.clubId)}&event=${encodeURIComponent(c.eventId)}`,
    }];
  }).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}
