export const SKILL_LEVELS = [
  { key: "Beginner", stars: 1 },
  { key: "Advanced Beginner", stars: 2 },
  { key: "Intermediate", stars: 3 },
  { key: "Advanced Intermediate", stars: 4 },
  { key: "Advanced", stars: 5 },
  { key: "Expert", stars: 6 },
];

export const COURT_LEVEL_OPTIONS = ["Any Level", ...SKILL_LEVELS.map((t) => t.key)];

export function skillLevelLabel(skill) {
  const tier = SKILL_LEVELS.find((t) => t.stars === skill);
  return tier ? tier.key : SKILL_LEVELS[0].key;
}

export function matchesCourtLevel(skill, courtLevel) {
  if (!courtLevel || courtLevel === "Any Level") return true;
  return skillLevelLabel(skill) === courtLevel;
}

// Pulls up to `count` players matching `courtLevel` from the front of `pool`,
// preserving priority order, and returns whoever's left for the next court.
export function pickForLevel(pool, courtLevel, count) {
  const taken = [];
  const remaining = [];
  for (const p of pool) {
    if (taken.length < count && matchesCourtLevel(p.skill, courtLevel)) taken.push(p);
    else remaining.push(p);
  }
  if (taken.length < count) return { taken: [], remaining: pool };
  return { taken, remaining };
}
