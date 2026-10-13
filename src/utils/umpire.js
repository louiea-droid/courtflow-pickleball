import { eventBase, sessionBase } from "./paths.js";

// The volunteer link: /umpire?club=C&event=E&code=K for a game, /umpire?session=S&code=K for a quick session.
export function umpireUrl(origin, base, code) {
  const e = encodeURIComponent;
  const where = base[0] === "sessions" ? `session=${e(base[1])}` : `club=${e(base[1])}&event=${e(base[3])}`;
  return `${origin}/umpire?${where}&code=${e(code)}`;
}

// The game and code a link points at, or null when the link is incomplete.
export function umpireTarget(search) {
  const p = new URLSearchParams(search);
  const code = p.get("code");
  const base = p.get("session") ? sessionBase(p.get("session")) : eventBase(p.get("club"), p.get("event"));
  return base && code ? { base, code } : null;
}
