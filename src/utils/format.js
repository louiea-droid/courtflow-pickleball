export const initials = (name) =>
  name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export const money = (n) => `$${(n || 0).toFixed(2)}`;

export const winPct = (p) => Math.round((p.wins / (p.games || 1)) * 100);

export const waitMinutes = (p) =>
  Math.max(0, Math.round((Date.now() - (p.checkedAt || Date.now())) / 60000));

export const elapsed = (start) => {
  const s = Math.max(0, Math.floor((Date.now() - (start || Date.now())) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export const PH_TIMEZONE = "Asia/Manila";

const phTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PH_TIMEZONE, hour: "numeric", minute: "2-digit", hour12: true,
});
const phClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PH_TIMEZONE, hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
});
const phDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PH_TIMEZONE, month: "short", day: "numeric", year: "numeric",
});

export const formatPHTime = (ms) => phTimeFormatter.format(new Date(ms || Date.now()));
export const formatPHClock = (date) => phClockFormatter.format(date);
export const formatPHDate = (ms) => phDateFormatter.format(new Date(ms || Date.now()));
