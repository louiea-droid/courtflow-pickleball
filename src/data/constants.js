export const SESSION_ID = "open-play";

export const seedSession = {
  location: "Centro Pickle Club",
  courts: 2,
  format: "Doubles",
  rotation: "Balanced",
  autoRotate: true,
  createdAt: Date.now(),
};

export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "queue", label: "Queue" },
  { key: "players", label: "Players" },
  { key: "stats", label: "Stats" },
];

export const TITLES = {
  dashboard: ["Live Court Rotation", "Keep games moving. Let the queue handle the arguing."],
  queue: ["Player Queue", "Firestore-synced waiting order across connected screens."],
  players: ["Players", "Roster and session performance."],
  stats: ["Session Stats", "Standings and playing-time snapshot."],
};
