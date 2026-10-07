// Open-play bookings. A booking keeps its attendees in joined order; the first
// `maxPlayers` are confirmed and the rest wait, so removing someone promotes the
// next person automatically (nothing stored to keep in sync).
// attendee: { id, name, playerId?, paid: "unpaid" | "paid" | "refunded", method: "cash" | "online", ref?, amount?, joinedAt }

const pad = (n) => String(n).padStart(2, "0");

export function splitAttendees(b) {
  const all = b.attendees || [];
  const max = b.maxPlayers || all.length;
  return { confirmed: all.slice(0, max), waitlist: all.slice(max) };
}

export function addAttendee(list, attendee) {
  return [...list, attendee].sort((a, b) => a.joinedAt - b.joinedAt);
}

// Expected = fee from every confirmed seat. Collected = money actually received
// (paid, not refunded), waitlisted payers included.
export function bookingTotals(b) {
  const { confirmed } = splitAttendees(b);
  const fee = b.fee || 0;
  const collected = (b.attendees || [])
    .filter((a) => a.paid === "paid")
    .reduce((n, a) => n + (a.amount ?? fee), 0);
  return {
    expected: fee * confirmed.length,
    collected,
    paidCount: confirmed.filter((a) => a.paid === "paid").length,
    seats: confirmed.length,
  };
}

export function endHM(b) {
  const [h, m] = b.startTime.split(":").map(Number);
  const t = (h * 60 + m + (b.durationMins || 0)) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

// Today's date (YYYY-MM-DD) and time (HH:MM) on the club's wall clock.
export function nowIn(timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}

// ponytail: an event that runs past midnight counts as over at the end of its date.
export function hasEnded(b, now) {
  if (b.date !== now.date) return b.date < now.date;
  const end = endHM(b);
  return end > b.startTime && end <= now.hm;
}

export const byStart = (a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime);

// What a player sees for their own booking, from the booking and their request.
export function myStatus(booking, requestId, requestStatus) {
  if (!booking) return { key: "gone", label: "This open play is no longer listed" };
  const { confirmed, waitlist } = splitAttendees(booking);
  const seat = confirmed.findIndex((a) => a.id === requestId);
  const wait = waitlist.findIndex((a) => a.id === requestId);
  const at = confirmed[seat] || waitlist[wait];
  if (at) {
    const paid = at.paid === "paid" ? "paid" : at.paid === "refunded" ? "refunded" : "unpaid";
    return seat >= 0
      ? { key: "confirmed", label: "You're in", paid }
      : { key: "waitlist", label: `Waitlist #${wait + 1}`, paid };
  }
  if (requestStatus === "declined") return { key: "declined", label: "Not accepted" };
  if (requestStatus === "approved") return { key: "gone", label: "Removed from the list by the host" };
  return { key: "pending", label: "Waiting for the host to confirm" };
}

// Upcoming vs past in the event's own time zone (stored when it was created), so a
// visitor in another zone sees the same answer. Events with no zone use the fallback.
export const hasEndedIn = (event, fallbackZone) => hasEnded(event, nowIn(event.timeZone || fallbackZone));

// The attendee a host's approval adds to the public event doc. Its id is the request's
// public seatId, never the request id (that is the secret key to the private request
// doc, which holds the phone number), and no contact detail is copied.
export const attendeeFromRequest = (request) => ({
  id: request.seatId, name: request.name, method: request.method, paid: "unpaid", joinedAt: request.createdAt,
  ...(request.ref ? { ref: request.ref } : {}),
});

// Over = its scheduled time has passed in its own zone, or the host ended the game early.
export const isOver = (event, fallbackZone) => event.status === "ended" || hasEndedIn(event, fallbackZone);

// What the public booking page lists: not a walk-in, not over.
export const isListed = (event, fallbackZone) => !event.walkIn && !isOver(event, fallbackZone);
