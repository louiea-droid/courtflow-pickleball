// Queue bug demo with fake data. Run: node scripts/queue-demo.mjs
// Drives the REAL pick/split functions the app uses (src/utils/rotationModes.js) the same way QueueApp does.
import { seatJoiners, selectForCourt, selectToJoin, splitTeams } from "../src/utils/rotationModes.js";

const STARS = { Beginner: 1, AdvBeg: 2, Int: 3, AdvInt: 4, Adv: 5, Expert: 6 };
let t = 0;
const NOW = Date.now();
// checkedAt: players arrived one minute apart, the first one 50 minutes ago
const mk = (name, skill, extra = {}) => ({ id: name, name, skill, games: 0, checkedAt: NOW - (50 - ++t) * 60000, gender: "M", ...extra });
const names = (ps) => ps.map((p) => `${p.name}(${p.skill})`).join(" ");
const sortQ = (ps) => [...ps].sort((a, b) => a.games - b.games || a.checkedAt - b.checkedAt);
const head = (s) => console.log(`\n=== ${s} ===`);
const flag = (ok, msg) => console.log(`${ok ? "  ok " : "  BUG"}  ${msg}`);

// ---------- 1. Skill Separated starves a short tier ----------
head("1. Skill Separated: a lone Expert at the front of the queue");
{
  let players = [mk("Eddie-Expert", 6), ...["A", "B", "C", "D", "E", "F", "G", "H"].map((n) => mk("Int" + n, 3))];
  const courts = 1;
  let rounds = 0;
  for (; rounds < 6; rounds++) {
    const q = sortQ(players);
    const { taken } = selectForCourt({ pool: q, court: {}, mode: "Skill Separated", need: 4, now: NOW + rounds * 20 * 60000 });
    taken.forEach((p) => { p.games++; p.checkedAt = NOW + rounds * 20 * 60000; });
    console.log(`  round ${rounds + 1}: ${names(taken)}`);
  }
  const eddie = players[0];
  flag(eddie.games > 0, `Eddie (waiting since the start) has played ${eddie.games} games after 6 rounds`);
}

// ---------- 2. Lock pulls a different tier into a Skill Separated court ----------
head("2. Lock In + Skill Separated: locked partner from another tier");
{
  const q = [mk("Ian", 3, { lockedWithId: "Ada" }), mk("Ivy", 3), mk("Ike", 3), mk("Ira", 3),
    mk("Ada", 5, { lockedWithId: "Ian" }), mk("Ann", 5), mk("Abe", 5), mk("Amy", 5)];
  const { taken, remaining } = selectForCourt({ pool: q, court: {}, mode: "Skill Separated", need: 4 });
  console.log("  court:", names(taken));
  console.log("  still waiting:", names(remaining));
  flag(new Set(taken.map((p) => p.skill)).size === 1, "match is a single skill level");
  flag(taken.map((p) => p.name).join() === "Ian,Ivy,Ike,Ira", "Ian is not pulled across levels (his lock is ignored)");
  const tierCount = remaining.filter((p) => p.skill === 3).length;
}

// ---------- 3. Challengers / top-up ignore locks ----------
head("3. Winners stay: challengers picked with no lock check");
{
  const winners = [mk("W1", 3), mk("W2", 3)];
  const pool = [mk("Lia", 3, { lockedWithId: "Leo" }), mk("Nick", 3), mk("Leo", 3, { lockedWithId: "Lia" })];
  const { taken } = selectToJoin({ pool, court: {}, seated: winners, mode: "Balanced", need: 2 });
  console.log("  challengers:", names(taken));
  const split = taken.some((p) => p.lockedWithId && !taken.some((x) => x.id === p.lockedWithId));
  flag(!split, "a locked player is never taken without their partner");
}

head("3b. Auto-fill top-up: locked partner can land on the other team");
{
  // Court has Alan on team A. Alan is locked with Dee. Queue order: Pat, Dee, Quinn.
  const seated = [mk("Alan", 3, { lockedWithId: "Dee" })];
  const pool = [mk("Pat", 3), mk("Dee", 3, { lockedWithId: "Alan" }), mk("Quinn", 3)];
  const { taken } = selectToJoin({ pool, court: {}, seated, mode: "Balanced", need: 3 });
  // same seating code as autoFillCourts: teamA.length < 2 ? A : B
  const [teamA, teamB] = seatJoiners(["Alan"], [], taken, 4).map((ids) => ids);
  console.log(`  Team A: ${teamA.join(" + ")}  vs  Team B: ${teamB.join(" + ")}`);
  flag(teamA.includes("Dee") === teamA.includes("Alan"), "locked pair Alan + Dee are on the same team");
}

// ---------- 4. Skill Separated challengers are all-or-nothing ----------
head("4+5. Winners stay with no same-level challenger / short queue: app-level fixes");
console.log("  These two are in QueueApp.recordWin (not a pure function): check them in the browser with scripts/seed-queue.mjs (sq3, sq4).");

// ---------- 6. Split sanity ----------
head("6. Fallback group: Skill Separated ignores stars when splitting (by design, see rotationModes.check.mjs)");
{
  const q = [mk("Zed", 6), mk("Yan", 5), mk("Xi", 1), mk("Wu", 2)];
  const [a, b] = splitTeams(q, "Skill Separated", false);
  console.log(`  Team A: ${a.join("+")}  vs  Team B: ${b.join("+")}`);
  const stars = (ids) => ids.reduce((s, id) => s + q.find((p) => p.id === id).skill, 0);
  console.log(`  star gap between teams = ${Math.abs(stars(a) - stars(b))} (left as is)`);
}
