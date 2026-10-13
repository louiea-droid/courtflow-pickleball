import { eventBase, sessionBase } from "./paths.js";

// A Live Board keeps working this long after its game ends, so a board left on shows the final results.
export const LIVE_AFTER_END_MS = 12 * 60 * 60 * 1000;

// A game's board: /live?club=C&event=E&key=K. The quick session's board stays /live?club=UID[&key=K].
export const liveUrl = (origin, clubId, eventId, key) =>
  `${origin}/live?club=${encodeURIComponent(clubId)}&event=${encodeURIComponent(eventId)}&key=${encodeURIComponent(key)}`;

// Which board a link opens, or null when it can't open one. A game's board needs its key (the rules check it).
export function liveTarget(search) {
  const p = new URLSearchParams(search);
  const club = p.get("club"), event = p.get("event"), key = p.get("key");
  if (!club) return null;
  if (event) return key ? { kind: "event", base: eventBase(club, event), key } : null;
  return { kind: "quick", base: sessionBase(club), key: key || null };
}

// The booking page's live strip: courts with players and a score for the match on them now, in court order.
export const liveChips = (courts) => [...courts]
  .sort((a, b) => (a.courtNumber || 0) - (b.courtNumber || 0))
  .filter((c) => (c.teamA?.length || c.teamB?.length) && c.score && c.score.start === c.start)
  .map((c) => ({ id: c.id, name: c.name || `Court ${c.courtNumber}`, t1: c.score.t1, t2: c.score.t2 }));
