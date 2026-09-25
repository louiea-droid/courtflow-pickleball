import { DEFAULT_DISPLAY } from "../data/constants.js";

// Applies the club's theme (Settings > Display) to <html>. styles.css does the
// rest: data-theme sets color-scheme, and every color derives from these vars.
// Cached in localStorage so index.html can apply it before first paint.
const THEME_CACHE_KEY = "courtflow-theme";
let applied = "";

// Text color for a solid background: white unless white would fall under 3:1
// (the WCAG large/bold-text floor), then the dark ink. White stays on every
// preset; only very light custom picks flip to dark.
// ponytail: 3:1 suits the bold button/header labels; body text on these would need 4.5:1.
export function readableOn(hex) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05) >= 3 ? "#fff" : "#0f1b15";
}

export function applyTheme(display = {}) {
  const { theme, accent, team1, team2 } = { ...DEFAULT_DISPLAY, ...display };
  const vars = {
    "--accent": accent, "--team1": team1, "--team2": team2,
    "--on-accent": readableOn(accent), "--on-team1": readableOn(team1), "--on-team2": readableOn(team2),
  };
  const key = JSON.stringify({ theme, vars });
  if (key === applied) return;
  applied = key;
  const root = document.documentElement;
  root.dataset.theme = theme;
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  try { localStorage.setItem(THEME_CACHE_KEY, key); } catch { /* private mode */ }
}

export function isDarkTheme() {
  const t = document.documentElement.dataset.theme;
  return t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
}

// Device-only switch for screens with no club loaded (login). Keeps the
// cached colors; the club’s saved theme takes over once it loads.
export function setDeviceTheme(theme) {
  const css = (name) => document.documentElement.style.getPropertyValue(name) || undefined;
  applyTheme({ theme, accent: css("--accent"), team1: css("--team1"), team2: css("--team2") });
}
