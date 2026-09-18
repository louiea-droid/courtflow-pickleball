export const MODE_DESCRIPTIONS = {
  "Balanced": "Builds fair teams and rotates turns while trying to reduce repeat partners.",
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
];

export const TITLES = {
  dashboard: ["Live Court Rotation", ],
  queue: ["Player Queue", ],
  players: ["Players", ],
  cost: ["Cost Division",],
  stats: ["Session Stats", ],
  guide: ["Guide",],
};
