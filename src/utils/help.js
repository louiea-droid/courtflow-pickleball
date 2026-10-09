import { MAJOR, MINOR } from "../data/help.js";

const hay = (s) => [s.title, s.summary, ...(s.steps || []), ...(s.extra || []).flatMap((e) => [e.title, e.body]), s.body]
  .filter(Boolean).join(" ").toLowerCase();

// The sections and minor entries that mention the text (everything for empty text).
export function filterHelp(text) {
  const q = (text || "").trim().toLowerCase();
  if (!q) return { major: MAJOR, minor: MINOR };
  return { major: MAJOR.filter((s) => hay(s).includes(q)), minor: MINOR.filter((m) => hay(m).includes(q)) };
}
