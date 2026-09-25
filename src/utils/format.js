export const initials = (name) =>
  name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export const money = (n) => `₱${(n || 0).toFixed(2)}`;

// Per-player share, to the cent, then rounded UP to the nearest `roundTo`
// pesos when set (so the pot never comes up short). 0 = exact split.
export const splitCost = (total, count, roundTo = 0) => {
  if (!count) return 0;
  const exact = Math.round((total / count) * 100) / 100;
  return roundTo > 0 ? Math.ceil(exact / roundTo) * roundTo : exact;
};

export const winPct = (p) => Math.round((p.wins / (p.games || 1)) * 100);

export const waitMinutes = (p) =>
  Math.max(0, Math.round((Date.now() - (p.checkedAt || Date.now())) / 60000));

export const elapsed = (start) => {
  const s = Math.max(0, Math.floor((Date.now() - (start || Date.now())) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// Every time and date in the app goes through these formatters, which follow
// the club's Display settings (Settings page). App and LiveBoard call
// applyDisplayPrefs with the session's saved prefs before their children
// render; a club that never set them stays on Philippine time, 12-hour.
// ponytail: module-level state, fine for one club per tab; move to context
// if a page ever shows two clubs at once.
let prefsKey = "";
let timeFmt, clockFmt, dateFmt;
let zoneLabel = "PHT";

export function applyDisplayPrefs({ timeZone = "Asia/Manila", hour12 = true } = {}) {
  const key = `${timeZone}|${hour12}`;
  if (key === prefsKey) return;
  prefsKey = key;
  const base = { timeZone, hour: "numeric", minute: "2-digit", hourCycle: hour12 ? "h12" : "h23" };
  timeFmt = new Intl.DateTimeFormat("en-US", base);
  clockFmt = new Intl.DateTimeFormat("en-US", { ...base, second: "2-digit" });
  dateFmt = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric", year: "numeric" });
  zoneLabel = timeZone === "Asia/Manila" ? "PHT"
    : new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || timeZone;
}
applyDisplayPrefs();

export const formatTime = (ms) => timeFmt.format(new Date(ms || Date.now()));
export const formatClock = (date) => clockFmt.format(date);
export const formatDate = (ms) => dateFmt.format(new Date(ms || Date.now()));
export const timeZoneLabel = () => zoneLabel;
