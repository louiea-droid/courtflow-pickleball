// Player self check-in (docs/superpowers/specs/2026-11-13-self-checkin-design.md): pure helpers for the /checkin page.
import { SKILL_LEVELS, isValidSkillLevel } from "./courtLevels.js";

// The 4-digit code shown on the Live Board (a new one each game and with New code).
export const newCheckinCode = () => String(Math.floor(1000 + Math.random() * 9000));
export const validCode = (c) => /^\d{4}$/.test(String(c || ""));

export const checkinUrl = (origin, clubId, eventId) =>
  `${origin}/checkin?club=${encodeURIComponent(clubId)}&event=${encodeURIComponent(eventId)}`;
export function checkinTarget(search) {
  const q = new URLSearchParams(search);
  const club = q.get("club"), event = q.get("event");
  const code = q.get("code");
  return club && event ? { clubId: club, eventId: event, base: ["clubs", club, "events", event], ...(validCode(code) ? { code } : {}) } : null;
}

// What a self-rating player picks: the app's levels in plain words.
const PLAIN = ["Just starting", "Can rally", "Play regularly", "Strong player", "Competitive", "Tournament level"];
export const LEVEL_CHOICES = SKILL_LEVELS.map((l, i) => ({ stars: l.stars, label: PLAIN[i] || l.key, level: l.key }));

export const normName = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

// Find the person behind a typed name, never handing back the whole list:
// { kind: "exact", players: [p] } | { kind: "few", players } (2-4 whose name starts with or holds every typed word)
// | { kind: "suggest", players: [p] } (one close typo) | { kind: "none", players: [] }.
export function matchName(players, typed) {
  const t = normName(typed);
  if (t.length < 2) return { kind: "none", players: [] };
  const named = players.map((p) => ({ p, n: normName(p.name) })).filter((x) => x.n);
  const exact = named.filter((x) => x.n === t);
  if (exact.length === 1) return { kind: "exact", players: [exact[0].p] };
  if (exact.length > 1) return { kind: "few", players: exact.slice(0, 4).map((x) => x.p) };
  const words = t.split(" ");
  const parts = named.filter((x) => words.every((w) => x.n.split(" ").some((nw) => nw.startsWith(w))));
  if (parts.length === 1) return { kind: "exact", players: [parts[0].p] };
  if (parts.length > 1 && parts.length <= 4) return { kind: "few", players: parts.map((x) => x.p) };
  if (parts.length > 4) return { kind: "none", players: [], tooMany: true };
  const limit = t.length <= 5 ? 1 : 2;
  const close = named.map((x) => ({ ...x, d: distance(t, x.n) })).filter((x) => x.d <= limit).sort((a, b) => a.d - b.d);
  if (close.length && (close.length === 1 || close[0].d < close[1].d)) return { kind: "suggest", players: [close[0].p] };
  return { kind: "none", players: [] };
}

// Only an unrated player picks a level; a rated one keeps the host's stars.
export const needsLevel = (p) => !p || !isValidSkillLevel(p.skill);
