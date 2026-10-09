// Which page a path belongs to. main.jsx picks the page from it; AccountApp and ClubApp use it
// for screens. Unknown paths, and the old pre-club URLs (/host, /event/...), go to the hub.
// decodeURIComponent throws on a bad %-escape, which would blank the whole app: keep the raw text instead.
const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function routeOf(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/live") return "live";
  if (path === "/open-play") return "open-play";
  if (path === "/club") return "quick";
  if (path === "/settings") return "settings";
  if (path === "/clubs") return "clubs";
  if (path === "/friends") return "friends";
  if (/^\/inbox(\/[^/]+)?$/.test(path)) return "inbox";
  if (path === "/clubs/new") return "clubs-new";
  if (path === "/clubs/find") return "clubs-find";
  const m = path.match(/^\/clubs\/[^/]+(\/.*)?$/);
  if (m) {
    const rest = m[1] || "";
    if (rest === "") return "club";
    if (rest === "/host") return "club-host";
    if (rest === "/settings") return "club-settings";
    if (rest === "/members") return "club-members";
    if (/^\/event\/[^/]+$/.test(rest)) return "club-event";
    if (/^\/event\/[^/]+\/game$/.test(rest)) return "club-game";
    if (/^\/event\/[^/]+\/queue$/.test(rest)) return "club-queue";
  }
  return "hub";
}

// "/clubs/<id>/..." -> "<id>" (decoded), else null. "/clubs/new" and "/clubs/find" are not clubs.
export function clubIdOf(pathname) {
  const m = pathname.replace(/\/+$/, "").match(/^\/clubs\/([^/]+)/);
  return m && !["new", "find"].includes(m[1]) ? decode(m[1]) : null;
}

// "/inbox/<chatId>" -> "<chatId>" (decoded), else null. The open chat is a parameter of the one inbox screen.
export function chatIdOf(pathname) {
  const m = pathname.replace(/\/+$/, "").match(/^\/inbox\/([^/]+)$/);
  return m ? decode(m[1]) : null;
}

// "/clubs/<id>/event/<eventId>[/game | /queue]" -> "<eventId>" (decoded), else null.
export function eventIdOf(pathname) {
  const m = pathname.replace(/\/+$/, "").match(/^\/clubs\/[^/]+\/event\/([^/]+?)(?:\/(?:game|queue))?$/);
  return m ? decode(m[1]) : null;
}
