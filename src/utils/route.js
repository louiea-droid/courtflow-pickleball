// Which page a path belongs to. main.jsx uses it to pick the page; AccountApp
// uses it for hub vs settings. Unknown paths go to the hub.
export function routeOf(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/live") return "live";
  if (path === "/open-play") return "open-play";
  if (path === "/club") return "club";
  if (path === "/settings") return "settings";
  if (path === "/host") return "host";
  if (/^\/event\/[^/]+$/.test(path)) return "event";
  return "hub";
}

// "/event/<id>" -> "<id>" (decoded), else null.
export function eventIdOf(pathname) {
  const m = pathname.replace(/\/+$/, "").match(/^\/event\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}
