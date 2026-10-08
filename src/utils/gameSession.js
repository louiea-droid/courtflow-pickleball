// Pure rules for running a game on an event. No Firestore here (that is useGameActions),
// so everything below is covered by gameSession.check.mjs.
import { normalizeMode, seedSession } from "../data/constants.js";
import { splitAttendees } from "./bookings.js";
import { matchCount } from "./stats.js";

// What the queue app sees as `session`: the event doc (its game settings and title) with the
// account-wide settings layered on. QueueApp merges the DEFAULT_* values over these.
export function buildGameSession(account = {}, event = {}) {
  return {
    ...event,
    location: event.title || "Open play",
    rules: account.rules,
    costDefaults: account.costDefaults,
    live: account.live,
    display: account.display,
    defaults: account.defaults,
  };
}

// The settings a game starts with, from the account's Session defaults.
export function gameStartFields(account = {}, now) {
  const d = account.defaults || {};
  return {
    status: "live",
    startedAt: now,
    courts: Math.max(1, Math.round(Number(d.courts)) || seedSession.courts),
    format: d.format || seedSession.format,
    mode: normalizeMode(d.mode) || seedSession.mode,
    autoRotate: true,
  };
}

export const courtDocs = (count, now) => Array.from({ length: count }, (_, i) => ({
  id: `court-${i + 1}`,
  data: { courtNumber: i + 1, start: now, teamA: [], teamB: [] },
}));

// Everyone who can be brought in: the joined list, then the waitlist. `players` are the
// game's current player docs (their id is the attendee id), so already-in rows are flagged.
export function gamePickList(event, players = []) {
  const { confirmed, waitlist } = splitAttendees(event);
  const inGame = new Set(players.map((p) => p.id));
  const row = (a, group, waitNo) => ({
    id: a.id, name: a.name, group, waitNo, paid: a.paid || "unpaid", inGame: inGame.has(a.id),
  });
  return [
    ...confirmed.map((a) => row(a, "joined", 0)),
    ...waitlist.map((a, i) => row(a, "waitlist", i + 1)),
  ];
}

// { seatId: uid } from the event's private requests: the bookers who were signed in when they asked.
// Only approved requests count. A request is a claim (anyone can send one naming a seat id they saw on the
// public attendee list), so the host's approval is what ties an account to a seat.
export function uidBySeat(requests = []) {
  return Object.fromEntries(
    requests
      .filter((r) => r.status === "approved" && r.seatId && typeof r.uid === "string")
      .map((r) => [r.seatId, r.uid]),
  );
}

// New player docs for the ticked attendees who are not in the game yet, in joined order.
// Checked out: the host taps each in as they arrive. Idempotent, so "Add to game" is safe to repeat.
// A booker who was signed in (`uidBySeat`) brings their account id onto the player, so their Home can show
// where they are in the queue.
export function playersToAdd(event, pickedIds, players, now, uids = {}) {
  const have = new Set(players.map((p) => p.id));
  const picked = new Set(pickedIds);
  return (event.attendees || [])
    .filter((a) => picked.has(a.id) && !have.has(a.id))
    .map((a, i) => ({
      id: a.id, name: a.name, skill: 0, gender: "", checked: false,
      games: 0, wins: 0, losses: 0, createdAt: now + i, checkedAt: now + i,
      ...(uids[a.id] ? { uid: uids[a.id] } : {}),
    }));
}

// The one cost entry for the booking fee, covering the attendees now in the game. `existing`
// is the entry already saved (if any), so a later "Add to game" keeps its Live Board visibility.
// Payment status comes from the event attendee record, which is the source of truth.
// Anyone already charged stays on it, even if they have since left the game.
export function bookingCostEntry(event, inGameIds, existing, now) {
  const fee = event.fee || 0;
  const charged = new Set(existing?.playerIds || []);
  const members = (event.attendees || []).filter((a) => inGameIds.has(a.id) || charged.has(a.id));
  if (fee <= 0 || !members.length) return null;
  const hours = (event.durationMins || 60) / 60;
  const total = fee * members.length;
  return {
    label: event.title, rate: total / hours, hours, courts: 1, total, perPerson: fee,
    playerIds: members.map((a) => a.id), bookingId: event.id,
    paid: Object.fromEntries(members.map((a) => [a.id, a.paid === "paid"])),
    visibleOnLive: existing?.visibleOnLive ?? false,
    createdAt: existing?.createdAt ?? now,
  };
}

// "17:52" -> "17:45".
export function floorQuarter(hm) {
  const [h, m] = hm.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(Math.floor(m / 15) * 15).padStart(2, "0")}`;
}

// An unscheduled "Play now" event: live from the start, no seats, no fee.
export function playNowEvent({ account, today, hm, timeZone, hostName, now }) {
  return {
    title: "Play now", date: today, startTime: floorQuarter(hm), durationMins: 240,
    maxPlayers: 0, fee: 0, level: "Any Level", notes: "", payInfo: "", attendees: [],
    walkIn: true, hostName, timeZone, createdAt: now,
    ...gameStartFields(account, now),
  };
}

// The event page's game line.
export function gameSummary(players, format) {
  return {
    players: players.length,
    checkedIn: players.filter((p) => p.checked).length,
    matches: matchCount(players, format),
  };
}
