export const MODE_DESCRIPTIONS = {
  "Balanced": "Rotates turns fairly and evens out each match by star rating: the strongest player teams with the weakest, so similar levels face each other. Avoids repeat partners when it can.",
  "Skill Separated": "Keeps similar skill levels together on open courts, even if a court has to wait.",
  "Skill Courts": "Runs separate queues for named skill groups on courts you've set a level for.",
  "Winners / Losers": "Winners play winners and losers play losers.",
  "Mixed Doubles": "Forms each team with one male and one female player.",
  "King/Queen of the Court": "Winners move up courts and losers move down (coming soon).",
  "Club Wars": "Two named groups compete; every match is Group A versus Group B (coming soon).",
  "Tournament": "Fixed doubles teams with a schedule and optional pools/playoffs (coming soon).",
};

export const COMING_SOON_MODES = ["King/Queen of the Court", "Club Wars", "Tournament"];

export const MODE_OPTIONS = Object.keys(MODE_DESCRIPTIONS);

// Club-wide queue rules and cost defaults, set on the Settings page. Saved
// values are merged over these, so a club that never touched them gets these.
export const DEFAULT_RULES = {
  gameAlertMinutes: 0, // 0 = off
  winnersStay: false,
  maxWinStreak: 2, // only used when winnersStay is on
  avoidRepeatPartners: false, // Balanced mode always does this
};
export const DEFAULT_COST = { rate: 0, roundTo: 0 }; // roundTo 0 = exact split
// `key` null = the plain ?club= link works; once regenerated, only ?key=<key> does.
export const DEFAULT_LIVE = { enabled: true, key: null, showSkill: true, showQueueRank: true, showStats: true };
// theme: "light" | "dark" | "system" (follows the device). accent, team1, team2: any hex color.
export const DEFAULT_DISPLAY = {
  timeZone: "Asia/Manila", hour12: true, theme: "light", accent: "#2fa55b", team1: "#6c5ce0", team2: "#0e9488",
};
export const ACCENT_PRESETS = [
  { value: "#2fa55b", label: "Court green" },
  { value: "#2f6fdb", label: "Blue" },
  { value: "#7a5af0", label: "Purple" },
  { value: "#d6457a", label: "Rose" },
  { value: "#e0701f", label: "Orange" },
];
export const TEAM_PRESETS = [
  { value: "#6c5ce0", label: "Purple" },
  { value: "#0e9488", label: "Teal" },
  { value: "#2f6fdb", label: "Blue" },
  { value: "#d6457a", label: "Rose" },
  { value: "#e0701f", label: "Orange" },
];

// Shape the custom <Select> expects, with coming-soon modes shown but disabled.
export const MODE_SELECT_OPTIONS = MODE_OPTIONS.map((m) => ({
  value: m,
  disabled: COMING_SOON_MODES.includes(m),
  tag: COMING_SOON_MODES.includes(m) ? "Soon" : undefined,
}));

export const seedSession = {
  location: "Centro Pickle Club",
  courts: 2,
  format: "Doubles",
  mode: "Balanced",
  autoRotate: true,
  createdAt: Date.now(),
};

export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "queue", label: "Queue" },
  { key: "players", label: "Players" },
  { key: "cost", label: "Cost" },
  { key: "stats", label: "Stats" },
  { key: "guide", label: "Guide" },
  { key: "settings", label: "Settings" },
];

export const TITLES = {
  dashboard: ["Live Court Rotation", ],
  queue: ["Player Queue", ],
  players: ["Players", ],
  cost: ["Cost Division",],
  stats: ["Session Stats", ],
  guide: ["Guide",],
  settings: ["Settings",],
};
