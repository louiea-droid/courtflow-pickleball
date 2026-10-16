import { DEFAULT_DISPLAY } from "../data/constants.js";

// Applies theme and club color tokens to <html>. The global theme preference
// is separate from club colors so display settings cannot override appearance.
// Cached in localStorage so index.html can apply it before first paint.
const THEME_CACHE_KEY = "courtflow-theme";
const GLOBAL_THEME_KEY = "courtflow-global-theme";
const THEMES = new Set(["light", "dark", "system"]);
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

// `persist: false` applies colors without replacing the last globally cached theme.
export function getGlobalTheme(fallback = "system") {
  try {
    const theme = localStorage.getItem(GLOBAL_THEME_KEY);
    return THEMES.has(theme) ? theme : fallback;
  } catch {
    return fallback;
  }
}

const OLD_DEFAULT_ACCENT = "#2fa55b";

export function applyTheme(display = {}, { persist = true, global = false } = {}) {
  const { theme, accent: picked, team1, team2 } = { ...DEFAULT_DISPLAY, ...display };
  // The old default green (before the CourtWave brand) follows the new default; any other pick is kept.
  const accent = picked === OLD_DEFAULT_ACCENT ? DEFAULT_DISPLAY.accent : picked;
  if (global) {
    try { localStorage.setItem(GLOBAL_THEME_KEY, theme); } catch { /* private mode */ }
  }
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
  if (!persist) return;
  try { localStorage.setItem(THEME_CACHE_KEY, key); } catch { /* private mode */ }
}

export function applyGlobalTheme(display = {}, options) {
  return applyTheme({ ...display, theme: getGlobalTheme() }, options);
}

export function setGlobalTheme(theme) {
  const css = (name, fallback) => document.documentElement.style.getPropertyValue(name) || fallback;
  applyTheme({
    theme,
    accent: css("--accent", DEFAULT_DISPLAY.accent),
    team1: css("--team1", DEFAULT_DISPLAY.team1),
    team2: css("--team2", DEFAULT_DISPLAY.team2),
  }, { global: true });
}

export function isDarkTheme() {
  const t = document.documentElement.dataset.theme;
  return t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
}

// Theme switch for screens without account settings. Keeps the current colors.
export function setDeviceTheme(theme) {
  setGlobalTheme(theme);
}
