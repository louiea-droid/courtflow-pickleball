# Umpire Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An umpire (a manager, or a volunteer with a link and no account) keeps the live score of one court from a phone; the score shows on the Dashboard and the Live Board, and the finished game is recorded through the existing `recordWin`.

**Architecture:** The score is one `score` map on the court doc (`utils/scoring.js`, pure). Managers score from a modal on each Dashboard court card. Volunteers open `/umpire?...&code=...`, sign in anonymously, register in `{base}/umpires/{uid}`, claim one court in `{base}/courtClaims/{courtId}` and may then change only that court's `score` field (Firestore rules). `{base}` is the same path idea as `utils/paths.js`: `sessions/{uid}` (quick session) or `clubs/{c}/events/{e}` (game).

**Tech Stack:** React 19, Firebase 12 (Firestore + anonymous Auth), Vite, `qrcode` (`QrCode.jsx`), plain `node` check scripts, `@firebase/rules-unit-testing` (`npm run test:rules`).

**Spec:** `docs/superpowers/specs/2026-10-13-umpire-scoring-design.md` (Task 9 syncs it with the decisions below).

## Global Constraints

- Colors only through the existing tokens (`var(--team1)`, `var(--team2)`, `var(--on-team1)`, `var(--on-team2)`, `var(--accent)`, ...), never raw hex. Neutral buttons are `.outline`; `.primary` once per screen region.
- Queue-app styles go in `src/styles.css`; account/club screens' styles in `src/clubs.css`. The umpire page and `ScoreKeeper` are queue-app style (`styles.css`).
- No avatar-initial badges next to names (plain names only).
- Dialogs use `components/Modal` / `ConfirmDialog` (Esc closes the top dialog).
- Check UI at phone width (390 px) and desktop: `npm run emulators` + `npm run dev:emu` (port 5300).
- Invoke the project skills named in CLAUDE.md for UI tasks (`frontend-design`, `ui-design-system`, `ui-ux-pro-max`, `senior-frontend`, `react-best-practices`) and `superpowers:verification-before-completion` before saying it is done.
- `firestore.rules` must be re-published in the Firebase console after this ships.
- Mark deliberate shortcuts with a `ponytail:` comment naming the ceiling.
- Every commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Failure modes the spec implies that no happy-path task covers (each has a test in the named task):

1. Two volunteers tap Claim on the same court at once: exactly one wins, the other sees "taken" (Task 3 rules test, Task 7 UI message).
2. A new match goes on a court (rotation, winners stay, Undo) while an umpire screen is open: the old score must not show on or leak into the new match (Task 1 `liveScore` stale check, Task 2 `recordWin` deletes `score`).
3. The host renews the link mid-game: old umpires lose access at once and their claims are cleared so courts are free again (Task 3 rules test, Task 6 `renewLink` batch).
4. The link is mangled, or the game ended, or the quick-session switch is off: the umpire page shows "This umpire link is no longer active" and never a blank screen or spinner (Task 4 `umpireTarget` check, Task 7).
5. Game decided at deuce (win by 2), extra rally taps after the game is over, adjust below 0, undo with nothing to undo (Task 1 check).
6. A court is removed or emptied while claimed: the umpire sees "No match on this court yet" and the claim survives for the next match (Task 7).

---

### Task 0: Keep other people's uncommitted work out of our commits

`git status` shows uncommitted changes that are not part of this feature in `src/QueueApp.jsx`, `src/views/Dashboard.jsx`, `src/LiveBoard.jsx`, `src/styles.css`, `src/data/constants.js`, `CLAUDE.md` (and others). Tasks 2, 5, 6, 8 and 9 edit those same files, and `git commit -- <file>` commits the whole file.

- [ ] **Step 1: Ask the owner** to commit or stash their pending changes before Task 2 (or to say "work in a worktree": then use `superpowers:using-git-worktrees` and start from the branch head). Do not start Task 2 until answered. Tasks 1, 3 and 4 only create new files or touch files with no pending changes (`firestore.rules`, `package.json`, `tests/`), so they can go first.
- [ ] **Step 2: Before each commit** in a later task run `git status --short` and `git diff --stat -- <files>`; the diff must contain only this feature's edits.

---

### Task 1: Scoring logic

**Files:**
- Create: `src/utils/scoring.js`
- Test: `src/utils/scoring.check.mjs`

**Interfaces:**
- Produces (all pure; team is `1` or `2`; team 1 = `court.teamA`, team 2 = `court.teamB`):
  - `newScore({ start, style = "sideout", to = 11, singles = false })` -> score
  - `liveScore(court, { style, to, singles })` -> the court's score if `court.score.start === court.start`, else `newScore(...)`
  - `rally(score, team)`, `adjust(score, team, delta)`, `undo(score)`, `firstServe(score, team)` -> new score
  - `winner(score)` -> `0 | 1 | 2`; `gamePoint(score)` -> `0 | 1 | 2`
  - `call(score)` -> `"4 - 2 - 1"`; `finalText(score)` -> `"11-7"` (winner's points first)
  - `SCORE_TARGETS = [11, 15, 21]`
- Score shape: `{ start, t1, t2, serving, server, style, to, singles, log }`.

- [ ] **Step 1: Write the failing check** `src/utils/scoring.check.mjs`

```js
// Self-check for the umpire score. Run: node src/utils/scoring.check.mjs
import assert from "node:assert";
import { adjust, call, finalText, firstServe, gamePoint, liveScore, newScore, rally, undo, winner } from "./scoring.js";

const play = (s, ...teams) => teams.reduce(rally, s);

// Side-out doubles starts 0-0-2, team 1 serving.
let s = newScore({ start: 100 });
assert.equal(call(s), "0 - 0 - 2");
assert.equal(call(rally(s, 1)), "1 - 0 - 2"); // serving team wins: point, same server
// Receiving team wins at server 2: side out, team 2 serves as server 1.
s = rally(s, 2);
assert.deepEqual([s.t1, s.t2, s.serving, s.server], [0, 0, 2, 1]);
assert.equal(call(s), "0 - 0 - 1");
// Team 2 scores twice, loses a rally at server 1 (-> server 2), then at server 2 (-> side out to team 1).
s = play(s, 2, 2);
assert.equal(call(s), "2 - 0 - 1");
s = rally(s, 1);
assert.deepEqual([s.serving, s.server], [2, 2]);
s = rally(s, 1);
assert.deepEqual([s.serving, s.server], [1, 1]);
assert.equal(call(s), "0 - 2 - 1"); // serving team's score first

// Undo steps back one rally; nothing to undo is a no-op.
assert.equal(call(undo(s)), "2 - 0 - 2");
assert.equal(undo(newScore({ start: 1 })).t1, 0);
const back = undo(rally(newScore({ start: 1 }), 1));
assert.equal(call(back), "0 - 0 - 2");

// Rally scoring: the rally winner scores, no server number.
let r = newScore({ start: 1, style: "rally" });
r = play(r, 2, 2, 1);
assert.equal(call(r), "1 - 2");
assert.equal(r.server, null);

// Singles side-out: no server number; the receiver winning only takes the serve.
let g = newScore({ start: 1, singles: true });
assert.equal(call(g), "0 - 0");
g = rally(g, 2);
assert.deepEqual([g.t1, g.t2, g.serving], [0, 0, 2]);
g = rally(g, 2);
assert.equal(g.t2, 1);

// First serve can be switched only before the first rally.
assert.equal(firstServe(newScore({ start: 1 }), 2).serving, 2);
assert.equal(firstServe(rally(newScore({ start: 1 }), 1), 2).serving, 1);

// Win by 2 (play to 11): 11-10 is not over, 12-10 is; 10-10 is not.
const at = (t1, t2, extra = {}) => ({ ...newScore({ start: 1, style: "rally" }), t1, t2, ...extra });
assert.equal(winner(at(11, 9)), 1);
assert.equal(winner(at(11, 10)), 0);
assert.equal(winner(at(12, 10)), 1);
assert.equal(winner(at(10, 12)), 2);
assert.equal(winner(at(10, 10)), 0);
assert.equal(winner(at(10, 5, { to: 15 })), 0);
// No more rallies after the game is over.
const done = at(11, 3);
assert.equal(rally(done, 2), done);
// Game point: side-out, only the serving team can score.
const sd = { ...newScore({ start: 1 }), t1: 10, t2: 5, serving: 1 };
assert.equal(gamePoint(sd), 1);
assert.equal(gamePoint({ ...sd, serving: 2 }), 0);
assert.equal(gamePoint({ ...sd, t2: 10 }), 0); // 11-10 would not win
assert.equal(gamePoint({ ...sd, t1: 9, t2: 10, serving: 2 }), 2);
assert.equal(gamePoint(at(10, 5)), 1); // rally scoring: either team
assert.equal(finalText(at(7, 11)), "11-7");

// Adjust never goes below 0 and can be undone; the log is capped at 50.
assert.equal(adjust(newScore({ start: 1 }), 1, -1).t1, 0);
assert.equal(adjust(newScore({ start: 1 }), 2, 1).t2, 1);
assert.equal(undo(adjust(newScore({ start: 1 }), 2, 1)).t2, 0);
let long = newScore({ start: 1, style: "rally", to: 99 });
for (let i = 0; i < 80; i++) long = rally(long, 1);
assert.equal(long.log.length, 50);

// A score left over from an earlier match (different start) reads as a fresh 0-0.
const court = { start: 200, teamA: ["a", "b"], teamB: ["c", "d"], score: { ...newScore({ start: 100 }), t1: 9 } };
assert.equal(liveScore(court, { style: "sideout", to: 11 }).t1, 0);
assert.equal(liveScore({ ...court, score: { ...court.score, start: 200 } }, {}).t1, 9);
assert.equal(liveScore({ ...court, score: undefined }, { singles: true }).singles, true);

console.log("scoring checks passed");
```

- [ ] **Step 2: Run it, expect FAIL** (`Cannot find module './scoring.js'`): `node src/utils/scoring.check.mjs`

- [ ] **Step 3: Write `src/utils/scoring.js`**

```js
// The live score of one court's match (docs/superpowers/specs/2026-10-13-umpire-scoring-design.md). Pure: every
// function returns a new score. Team 1 is court.teamA, team 2 is court.teamB. The score lives on the court doc and
// only counts while score.start equals the court's start, so a new match on the court never shows an old score.
export const SCORE_TARGETS = [11, 15, 21];
const LOG_MAX = 50;
const other = (team) => (team === 1 ? 2 : 1);
const key = (team) => (team === 1 ? "t1" : "t2");

// Side-out doubles starts 0-0-2: the first serving team gets one server. Team 1 serves first (see firstServe).
export function newScore({ start, style = "sideout", to = 11, singles = false }) {
  return { start, t1: 0, t2: 0, serving: 1, server: style === "sideout" && !singles ? 2 : null, style, to, singles, log: [] };
}

export function liveScore(court, { style, to, singles } = {}) {
  const s = court.score;
  return s && s.start === court.start && Array.isArray(s.log) ? s : newScore({ start: court.start, style, to, singles });
}

const snap = (s) => ({ t1: s.t1, t2: s.t2, serving: s.serving, server: s.server });
const push = (s, next) => ({ ...s, ...next, log: [...s.log, snap(s)].slice(-LOG_MAX) });

export function winner(s) {
  return Math.max(s.t1, s.t2) >= s.to && Math.abs(s.t1 - s.t2) >= 2 ? (s.t1 > s.t2 ? 1 : 2) : 0;
}

// The team that wins the game with the next point (side-out: only the serving team scores), else 0.
export function gamePoint(s) {
  if (winner(s)) return 0;
  const wins = (t) => {
    const mine = s[key(t)] + 1;
    return mine >= s.to && mine - s[key(other(t))] >= 2;
  };
  return (s.style === "rally" ? [1, 2] : [s.serving]).find(wins) || 0;
}

// The team that won the rally. Rally: it scores and serves. Side-out: only the serving team scores; the other team
// winning moves the serve (server 1 -> 2, then side out; singles: straight to a side out).
export function rally(s, team) {
  if (winner(s)) return s;
  if (s.style === "rally") return push(s, { [key(team)]: s[key(team)] + 1, serving: team });
  if (team === s.serving) return push(s, { [key(team)]: s[key(team)] + 1 });
  if (s.singles) return push(s, { serving: other(s.serving) });
  return s.server === 2 ? push(s, { serving: other(s.serving), server: 1 }) : push(s, { server: 2 });
}

export function adjust(s, team, delta) {
  const next = Math.max(0, s[key(team)] + delta);
  return next === s[key(team)] ? s : push(s, { [key(team)]: next });
}

export function undo(s) {
  const prev = s.log[s.log.length - 1];
  return prev ? { ...s, ...prev, log: s.log.slice(0, -1) } : s;
}

// Who serves first, only before the first rally.
export const firstServe = (s, team) => (s.log.length === 0 && s.t1 + s.t2 === 0 ? { ...s, serving: team } : s);

// The spoken score: serving team first, then the receiver, then the server number ("4 - 2 - 1").
export function call(s) {
  if (s.style === "rally") return `${s.t1} - ${s.t2}`;
  const mine = s.serving === 1 ? s.t1 : s.t2;
  const theirs = s.serving === 1 ? s.t2 : s.t1;
  return s.singles ? `${mine} - ${theirs}` : `${mine} - ${theirs} - ${s.server}`;
}

// "11-7": the winner's points first, for the match log.
export const finalText = (s) => `${Math.max(s.t1, s.t2)}-${Math.min(s.t1, s.t2)}`;
```

- [ ] **Step 4: Run, expect `scoring checks passed`.** If an assertion fails, fix `scoring.js` (the check encodes the spec).
- [ ] **Step 5: Commit**

```bash
git add src/utils/scoring.js src/utils/scoring.check.mjs
git commit -m "feat: scoring logic for umpire scoring (side-out, rally, win by 2, undo)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Scoring settings and the score on the match log

Needs Task 0 answered (edits `QueueApp.jsx`, `constants.js`).

**Files:**
- Modify: `src/data/constants.js` (`DEFAULT_RULES`)
- Modify: `src/views/Settings.jsx` (two rows under Queue rules, after "How far back to remember")
- Modify: `src/QueueApp.jsx` (`recordWin`)
- Modify: `src/views/Dashboard.jsx` (`winWithEdit` passes the score text)
- Modify: `src/components/MatchLogRow.jsx` (show the score)

**Interfaces:**
- Consumes: `SCORE_TARGETS` from Task 1.
- Produces: `rules.scoreStyle` (`"sideout" | "rally"`, default `"sideout"`), `rules.scoreTo` (11 | 15 | 21, default 11); `recordWin(courtId, side, nextIds = null, scoreText = null)`; the `matchLog` doc gains optional `score: "11-7"`.

- [ ] **Step 1: constants** - add to `DEFAULT_RULES`:

```js
  scoreStyle: "sideout", // umpire scoring: "sideout" (serving team scores, server 1/2) or "rally"
  scoreTo: 11, // play to 11, 15 or 21, win by 2
```

(`RULE_DEFAULTS_VERSION` stays: `QueueApp` and `useClub` already merge `{ ...DEFAULT_RULES, ...saved }`.)

- [ ] **Step 2: Settings rows.** Next to `HISTORY_OPTIONS` add:

```js
const SCORE_STYLE_OPTIONS = [{ value: "sideout", label: "Side-out (serving team scores)" }, { value: "rally", label: "Rally (every rally scores)" }];
const SCORE_TO_OPTIONS = SCORE_TARGETS.map((n) => ({ value: n, label: `Play to ${n}` }));
```

(import `SCORE_TARGETS` from `../utils/scoring`). After the "How far back to remember" `SettingsRow`, inside the same group, add two rows in the same shape:

```jsx
          <SettingsRow title="Scoring style" body="How the umpire's score works. Side-out is the official pickleball way: only the serving team scores, and the serve passes from server 1 to server 2 to the other team. Rally scores on every rally.">
            <div className="account-select">
              <Select value={rules.scoreStyle} onChange={(scoreStyle) => onSetRules({ scoreStyle })} options={SCORE_STYLE_OPTIONS} />
            </div>
          </SettingsRow>
          <SettingsRow title="Play to" body="A game ends at this score, and the winner must lead by 2.">
            <div className="account-select">
              <Select value={rules.scoreTo} onChange={(scoreTo) => onSetRules({ scoreTo })} options={SCORE_TO_OPTIONS} />
            </div>
          </SettingsRow>
```

Check how `rules` reaches Settings (it is passed with defaults already merged for `rules.maxWinStreak`); if the club-mode Settings builds rules differently, make the same two rows work there too.

- [ ] **Step 3: `recordWin`.** Change the signature and three places in `src/QueueApp.jsx`:

```js
  async function recordWin(courtId, side, nextIds = null, scoreText = null) {
```

in the `batch.set(logRef, {...})` object add `...(scoreText ? { score: scoreText } : {}),`; in `undo.update(courtRef, {...})` add `score: was(c.score),`; and right after the `if (stay) {...} else if (autoRotateOn) {...} else {...}` chain, before `await batch.commit();`, add (the result ends the match, so its live score goes):

```js
    batch.update(courtRef, { score: deleteField() });
```

(`deleteField` is already imported.) A second `update` of the same doc in one batch merges.

- [ ] **Step 4: Dashboard.** `winWithEdit = async (courtId, side) => {...}` becomes `async (courtId, side, scoreText = null)` and its `recordWin(courtId, side, edit?.every(Boolean) ? edit : null)` call becomes `recordWin(courtId, side, edit?.every(Boolean) ? edit : null, scoreText)`.

- [ ] **Step 5: MatchLogRow.** In `.matchlog-meta` after the court span add `{match.score && <span className="matchlog-score">{match.score}</span>}` and one rule in `styles.css` next to the other `.matchlog-*` rules: `.matchlog-score{font-weight:700;font-variant-numeric:tabular-nums}`.

- [ ] **Step 6: Verify.** `npm run build` passes; `node src/utils/rotationModes.check.mjs` still passes. In the emulator app: Settings shows the two rows and they persist; recording a win still works and Undo restores the court.
- [ ] **Step 7: Commit** (check `git diff --stat` first, Task 0 step 2).

---

### Task 3: Firestore rules and rules test

**Files:**
- Modify: `firestore.rules`
- Create: `tests/umpire.test.mjs`
- Modify: `package.json` (`test:rules` script)

**Interfaces:**
- Produces (data model, used by Tasks 4-8), under a `{base}` = `sessions/{sid}` or `clubs/{c}/events/{e}`:
  - `{base}/private/umpire` = `{ code, style, to }` (managers/owner write; managers/owner and registered umpires `get`)
  - `{base}/umpires/{uid}` = `{ code, name, at }` (a person creates their own with the current code; own `get`; holder or manager deletes; managers/owner list)
  - `{base}/courtClaims/{courtId}` = `{ uid, name }` (an umpire creates only if missing; holder or manager deletes; managers/owner write; managers/owner/umpires read)
  - `{base}/courts/{courtId}`: an umpire holding the claim may update only `score` (valid shape)
  - quick session only: `sessions/{sid}.umpireOn == true` is required, event: `status == 'live'`.

- [ ] **Step 1: Write the failing test** `tests/umpire.test.mjs`

```js
// Firestore rules for volunteer umpires: registering with the link code, claiming one court, scoring only it.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

const rules = fs.readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "umpire-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });
const anon = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: "anonymous" } }).firestore();
const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const signedOut = env.unauthenticatedContext().firestore();
const v1 = anon("v1"), v2 = anon("v2"), nobody = anon("s1"), mgr = real("mgr"), owner = anon("own1");
const CODE = "AAAA2222";
const score = (extra = {}) => ({ start: 111, t1: 1, t2: 0, serving: 1, server: 2, style: "sideout", to: 11, singles: false, log: [], ...extra });
const E = "clubs/pub/events/ev1"; // a live game
const S = "sessions/own1"; // a quick session

async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "clubs/pub"), { name: "pub", nameLower: "pub", visibility: "public", ownerId: "own", createdAt: 1 });
    await setDoc(doc(db, "clubs/pub/members/mgr"), { role: "manager", name: "mgr", joinedAt: 1 });
    for (const [id, status] of [["ev1", "live"], ["ev2", "ended"]]) {
      await setDoc(doc(db, `clubs/pub/events/${id}`), { title: id, status, date: "2026-10-13" });
      await setDoc(doc(db, `clubs/pub/events/${id}/private/umpire`), { code: CODE, style: "sideout", to: 11 });
      for (const c of ["c1", "c2"]) await setDoc(doc(db, `clubs/pub/events/${id}/courts/${c}`), { courtNumber: 1, start: 111, teamA: ["p1"], teamB: ["p2"] });
      await setDoc(doc(db, `clubs/pub/events/${id}/players/p1`), { name: "Ana" });
      await setDoc(doc(db, `clubs/pub/events/${id}/matchLog/m1`), { court: "Court 1" });
    }
    await setDoc(doc(db, S), { location: "Quick", umpireOn: true });
    await setDoc(doc(db, `${S}/private/umpire`), { code: CODE, style: "sideout", to: 11 });
    await setDoc(doc(db, `${S}/courts/c1`), { courtNumber: 1, start: 111, teamA: ["p1"], teamB: ["p2"] });
    await setDoc(doc(db, `${S}/courts/c2`), { courtNumber: 2, start: 111, teamA: [], teamB: [] });
  });
}
const join = (db, base, uid, extra = {}) => setDoc(doc(db, `${base}/umpires/${uid}`), { code: CODE, name: "Sam", at: Date.now(), ...extra });

for (const base of [E, S]) {
  // ---- Registering: the current code, your own uid, a name, nothing else
  await seed();
  await assertSucceeds(join(v1, base, "v1"));
  await seed(); await assertFails(join(v1, base, "v1", { code: "WRONG222" }));
  await assertFails(join(v1, base, "v2")); // someone else's uid
  await assertFails(join(v1, base, "v1", { name: "" }));
  await assertFails(join(v1, base, "v1", { extra: 1 }));
  await assertFails(join(signedOut, base, "v1"));
  // ---- Before registering (or after a stranger): no settings, no claims, no courts' score
  await assertFails(getDoc(doc(nobody, `${base}/private/umpire`)));
  await assertFails(getDocs(collection(nobody, `${base}/courtClaims`)));
  await assertFails(getDocs(collection(nobody, `${base}/umpires`)));
  // ---- A registered umpire reads the settings, claims, and the player list
  await join(v1, base, "v1"); await join(v2, base, "v2");
  await assertSucceeds(getDoc(doc(v1, `${base}/private/umpire`)));
  await assertSucceeds(getDocs(collection(v1, `${base}/courtClaims`)));
  await assertSucceeds(getDoc(doc(v1, `${base}/umpires/v1`))); // own record
  await assertFails(getDoc(doc(v1, `${base}/umpires/v2`))); // not someone else's
  await assertFails(getDocs(collection(v1, `${base}/umpires`)));
  // ---- One umpire per court: the claim is a create, so the second one is refused
  await assertSucceeds(setDoc(doc(v1, `${base}/courtClaims/c1`), { uid: "v1", name: "Sam" }));
  await assertFails(setDoc(doc(v2, `${base}/courtClaims/c1`), { uid: "v2", name: "Lee" }));
  await assertFails(setDoc(doc(v2, `${base}/courtClaims/c2`), { uid: "v1", name: "Sam" })); // not as someone else
  await assertFails(setDoc(doc(v2, `${base}/courtClaims/c2`), { uid: "v2", name: "Lee", extra: 1 }));
  await assertFails(setDoc(doc(nobody, `${base}/courtClaims/c2`), { uid: "s1", name: "x" })); // not registered
  // ---- Scoring: only the court you hold, only the score field, a valid shape
  await assertSucceeds(updateDoc(doc(v1, `${base}/courts/c1`), { score: score() }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c2`), { score: score() })); // not claimed
  await assertFails(updateDoc(doc(v2, `${base}/courts/c1`), { score: score() })); // someone else's court
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { teamA: [] }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: score(), teamA: [] }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: score({ t1: -1 }) }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: score({ evil: 1 }) }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: "11-0" }));
  await assertFails(updateDoc(doc(v1, `${base}/courts/c1`), { score: score({ log: new Array(51).fill({}) }) }));
  await assertFails(setDoc(doc(v1, `${base}/players/p9`), { name: "x" })); // nothing else is writable
  await assertFails(getDocs(collection(v1, `${base}/matchLog`)));
  // ---- Release: the holder, not another umpire
  await assertFails(deleteDoc(doc(v2, `${base}/courtClaims/c1`)));
  await assertSucceeds(deleteDoc(doc(v1, `${base}/courtClaims/c1`)));
}

// ---- Events: managers read the registrations, release and assign; a stranger reads nothing
await seed(); await join(v1, E, "v1"); await join(v2, E, "v2");
await setDoc(doc(v1, `${E}/courtClaims/c1`), { uid: "v1", name: "Sam" });
await assertSucceeds(getDocs(collection(mgr, `${E}/umpires`)));
await assertSucceeds(setDoc(doc(mgr, `${E}/courtClaims/c1`), { uid: "v2", name: "Lee" })); // assign
await assertFails(updateDoc(doc(v1, `${E}/courts/c1`), { score: score() })); // v1 lost it
await assertSucceeds(updateDoc(doc(v2, `${E}/courts/c1`), { score: score() }));
await assertSucceeds(deleteDoc(doc(mgr, `${E}/courtClaims/c1`)));
// The host renews the link: old registrations stop working at once.
await assertSucceeds(setDoc(doc(v2, `${E}/courtClaims/c1`), { uid: "v2", name: "Lee" }));
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `${E}/private/umpire`), { code: "BBBB3333", style: "sideout", to: 11 }));
await assertFails(updateDoc(doc(v2, `${E}/courts/c1`), { score: score() }));
await assertFails(getDoc(doc(v2, `${E}/private/umpire`)));
await assertFails(getDocs(collection(v2, `${E}/players`)));
await assertFails(setDoc(doc(anon("v3"), `${E}/umpires/v3`), { code: CODE, name: "Old", at: 1 })); // the old link
// An ended game refuses scoring and new umpires.
await seed(); await join(v1, E, "v1");
await setDoc(doc(v1, `${E}/courtClaims/c1`), { uid: "v1", name: "Sam" });
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), E), { title: "ev1", status: "ended", date: "2026-10-13" }));
await assertFails(updateDoc(doc(v1, `${E}/courts/c1`), { score: score() }));
await assertFails(join(v2, E, "v2"));
await seed(); await assertFails(join(v1, "clubs/pub/events/ev2", "v1")); // registering on an ended game

// ---- Quick session: the owner decides (umpireOn), the code and registrations are private, the owner manages them
await seed();
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), S), { location: "Quick", umpireOn: false }));
await assertFails(join(v1, S, "v1"));
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), S), { location: "Quick", umpireOn: true }));
await assertSucceeds(join(v1, S, "v1"));
await assertFails(getDoc(doc(signedOut, `${S}/private/umpire`))); // sessions are public to read, this is not
await assertFails(getDocs(collection(signedOut, `${S}/umpires`)));
await assertFails(getDocs(collection(signedOut, `${S}/courtClaims`)));
await assertSucceeds(getDocs(collection(signedOut, `${S}/courts`))); // the Live Board keeps working
await assertSucceeds(getDoc(doc(owner, `${S}/private/umpire`)));
await assertSucceeds(getDocs(collection(owner, `${S}/umpires`)));
await assertSucceeds(setDoc(doc(owner, `${S}/courtClaims/c1`), { uid: "v1", name: "Sam" }));
await assertSucceeds(updateDoc(doc(v1, `${S}/courts/c1`), { score: score() }));
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), S), { location: "Quick", umpireOn: false }));
await assertFails(updateDoc(doc(v1, `${S}/courts/c1`), { score: score() })); // the owner turned it off

await env.cleanup();
console.log("umpire rules passed");
```

- [ ] **Step 2: Add to `package.json`** `test:rules`: append ` && node tests/umpire.test.mjs` inside the quoted command. Run `npm run test:rules`: the umpire test FAILS (rules not written yet), the other tests still pass.

- [ ] **Step 3: Rules - helpers.** In `firestore.rules`, next to `validName`, add (all inside the existing `match /databases/{database}/documents` block):

```
    // ---- Volunteer umpires (docs/superpowers/specs/2026-10-13-umpire-scoring-design.md).
    // A person registers with the game's current code, then claims one court and may change only its score.
    // u: the caller's umpires/{uid} path, p: the game's private/umpire path. A renewed code stops every old record.
    function umpireIn(u, p) {
      return exists(u) && exists(p) && get(u).data.code == get(p).data.code;
    }
    function eventUmpire(c, e) {
      return request.auth != null
        && get(/databases/$(database)/documents/clubs/$(c)/events/$(e)).data.status == 'live'
        && umpireIn(/databases/$(database)/documents/clubs/$(c)/events/$(e)/umpires/$(request.auth.uid),
                    /databases/$(database)/documents/clubs/$(c)/events/$(e)/private/umpire);
    }
    function sessionUmpire(s) {
      return request.auth != null
        && get(/databases/$(database)/documents/sessions/$(s)).data.get('umpireOn', false) == true
        && umpireIn(/databases/$(database)/documents/sessions/$(s)/umpires/$(request.auth.uid),
                    /databases/$(database)/documents/sessions/$(s)/private/umpire);
    }
    function validUmpireRecord(d, p) {
      return d.keys().hasOnly(['code', 'name', 'at']) && d.keys().hasAll(['code', 'name', 'at'])
        && validName(d.name) && d.name.size() <= 40 && d.at is number
        && exists(p) && d.code == get(p).data.code;
    }
    function validClaim(d) {
      return d.keys().hasOnly(['uid', 'name']) && d.keys().hasAll(['uid', 'name'])
        && d.uid == request.auth.uid && validName(d.name) && d.name.size() <= 40;
    }
    function validScore(s) {
      return s is map
        && s.keys().hasOnly(['start', 't1', 't2', 'serving', 'server', 'style', 'to', 'singles', 'log'])
        && s.t1 is int && s.t1 >= 0 && s.t1 <= 99 && s.t2 is int && s.t2 >= 0 && s.t2 <= 99
        && s.log is list && s.log.size() <= 50;
    }
    // An update that changes only the score, on a court this umpire holds.
    function scoreOnly() {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['score'])
        && validScore(request.resource.data.score);
    }
```

(`data.get('umpireOn', false)` tolerates a session doc without the field. If the emulator rejects any construct, adjust syntax, the test is the contract.)

- [ ] **Step 4: Rules - quick sessions.** In `match /sessions/{sessionId}` change the wildcard read line to

```
        allow read: if !(coll in ['bookingRequests', 'private', 'umpires', 'courtClaims']) || isClub(sessionId);
```

and after that wildcard block (still inside `match /sessions/{sessionId}`) add:

```
      match /private/{id} {
        allow get: if id == 'umpire' && sessionUmpire(sessionId);
      }
      match /umpires/{uid} {
        allow get: if request.auth != null && request.auth.uid == uid;
        allow create: if request.auth != null && request.auth.uid == uid
          && get(/databases/$(database)/documents/sessions/$(sessionId)).data.get('umpireOn', false) == true
          && validUmpireRecord(request.resource.data, /databases/$(database)/documents/sessions/$(sessionId)/private/umpire);
        allow delete: if request.auth != null && request.auth.uid == uid;
      }
      match /courtClaims/{courtId} {
        allow read: if sessionUmpire(sessionId);
        allow create: if sessionUmpire(sessionId) && validClaim(request.resource.data);
        allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
      }
      match /courts/{courtId} {
        allow update: if sessionUmpire(sessionId) && scoreOnly()
          && exists(/databases/$(database)/documents/sessions/$(sessionId)/courtClaims/$(courtId))
          && get(/databases/$(database)/documents/sessions/$(sessionId)/courtClaims/$(courtId)).data.uid == request.auth.uid;
      }
```

(The owner keeps full access through the existing wildcard `isClub` write and the wildcard read.) Note: `players` and `courts` stay public-read through the wildcard.

- [ ] **Step 5: Rules - events.** Inside `match /events/{eventId}`, after the `match /{sub}/{docId}` block, add the same five blocks for the event (`eventUmpire(clubId, eventId)` instead of `sessionUmpire(sessionId)`, `isManager(clubId)` reads/deletes in addition, and the event path in the `get`/`exists` calls). Differences from the quick-session block:

```
        match /private/{id} {
          allow get: if id == 'umpire' && eventUmpire(clubId, eventId);
        }
        match /umpires/{uid} {
          allow get: if request.auth != null && request.auth.uid == uid;
          allow create: if request.auth != null && request.auth.uid == uid
            && get(/databases/$(database)/documents/clubs/$(clubId)/events/$(eventId)).data.status == 'live'
            && validUmpireRecord(request.resource.data, /databases/$(database)/documents/clubs/$(clubId)/events/$(eventId)/private/umpire);
          allow delete: if request.auth != null && request.auth.uid == uid;
        }
        match /courtClaims/{courtId} {
          allow read: if eventUmpire(clubId, eventId);
          allow create: if eventUmpire(clubId, eventId) && validClaim(request.resource.data);
          allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
        }
        match /players/{playerId} {
          allow read: if eventUmpire(clubId, eventId);
        }
        match /courts/{courtId} {
          allow read: if eventUmpire(clubId, eventId);
          allow update: if eventUmpire(clubId, eventId) && scoreOnly()
            && exists(/databases/$(database)/documents/clubs/$(clubId)/events/$(eventId)/courtClaims/$(courtId))
            && get(/databases/$(database)/documents/clubs/$(clubId)/events/$(eventId)/courtClaims/$(courtId)).data.uid == request.auth.uid;
        }
```

Managers already read and write all of these through the existing `match /{sub}/{docId}` (managers-only wildcard); the umpire blocks only add access.

- [ ] **Step 6: Run `npm run test:rules`.** All suites incl. `umpire rules passed`. Fix rules, not the test, unless the test contradicts the spec.
- [ ] **Step 7: Commit**

```bash
git add firestore.rules tests/umpire.test.mjs package.json
git commit -m "feat: rules for volunteer umpires (register with code, claim a court, score only)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Umpire data helpers and link parsing

**Files:**
- Create: `src/utils/umpire.js` (pure: link build/parse)
- Create: `src/utils/umpire.check.mjs`
- Create: `src/utils/umpireData.js` (Firestore writes)
- Create: `src/hooks/useUmpireLink.js` (host: the live `private/umpire` doc)

**Interfaces:**
- Consumes: `eventBase`, `sessionBase` (`utils/paths.js`), `newInviteCode` (`utils/clubs.js`), `useDocs` (`hooks/useLiveDocs.js`).
- Produces:
  - `umpireUrl(origin, base, code)` -> `"https://x/umpire?club=C&event=E&code=K"` or `"...?session=S&code=K"`
  - `umpireTarget(search)` -> `{ base, code } | null`
  - `useUmpireLink(base)` -> `{ code, style, to, ready }` (`code` null until created)
  - `umpireData.js`: `createLink(base, { style, to })`, `renewLink(base, { style, to, umpires, claims })`, `syncSettings(base, { style, to })`, `joinAsUmpire(base, uid, { code, name })`, `readSettings(base)`, `claimCourt(base, courtId, uid, name)`, `releaseCourt(base, courtId)`, `assignCourt(base, courtId, { id, name })`, `writeScore(base, courtId, score)`.

- [ ] **Step 1: Failing check** `src/utils/umpire.check.mjs`

```js
// Self-check for the umpire link. Run: node src/utils/umpire.check.mjs
import assert from "node:assert";
import { umpireTarget, umpireUrl } from "./umpire.js";

const event = ["clubs", "c1", "events", "e 1"];
const url = umpireUrl("https://x.test", event, "ABCD2345");
assert.equal(url, "https://x.test/umpire?club=c1&event=e%201&code=ABCD2345");
assert.deepEqual(umpireTarget(new URL(url).search), { base: event, code: "ABCD2345" });
const quick = umpireUrl("https://x.test", ["sessions", "u1"], "ABCD2345");
assert.equal(quick, "https://x.test/umpire?session=u1&code=ABCD2345");
assert.deepEqual(umpireTarget(new URL(quick).search), { base: ["sessions", "u1"], code: "ABCD2345" });
// A mangled or half-copied link is no target, never a crash.
for (const bad of ["", "?code=ABCD2345", "?club=c1&code=ABCD2345", "?club=c1&event=e1", "?session=u1", "?session=&code=x"]) {
  assert.equal(umpireTarget(bad), null, bad);
}
console.log("umpire link checks passed");
```

- [ ] **Step 2: Run, expect FAIL.** Then write `src/utils/umpire.js`:

```js
import { eventBase, sessionBase } from "./paths";

// The volunteer link: /umpire?club=C&event=E&code=K for a game, /umpire?session=S&code=K for a quick session.
export function umpireUrl(origin, base, code) {
  const e = encodeURIComponent;
  const where = base[0] === "sessions" ? `session=${e(base[1])}` : `club=${e(base[1])}&event=${e(base[3])}`;
  return `${origin}/umpire?${where}&code=${e(code)}`;
}

// The game and code a link points at, or null when the link is incomplete.
export function umpireTarget(search) {
  const p = new URLSearchParams(search);
  const code = p.get("code");
  const base = p.get("session") ? sessionBase(p.get("session")) : eventBase(p.get("club"), p.get("event"));
  return base && code ? { base, code } : null;
}
```

Run the check, expect `umpire link checks passed`.

- [ ] **Step 3: `src/utils/umpireData.js`**

```js
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { newInviteCode } from "./clubs";

const at = (base, ...rest) => doc(db, ...base, ...rest);

// ---- Host (manager / quick-session owner)
// The link's code and the scoring settings the volunteer's screen uses travel in one owner-only doc.
export async function createLink(base, { style, to }) {
  const code = newInviteCode();
  await setDoc(at(base, "private", "umpire"), { code, style, to });
  return code;
}
// New link: a new code stops every old link, and registered umpires and their claims are cleared so courts are free again.
export async function renewLink(base, { style, to, umpires = [], claims = [] }) {
  const code = newInviteCode();
  const batch = writeBatch(db);
  batch.set(at(base, "private", "umpire"), { code, style, to });
  umpires.forEach((u) => batch.delete(at(base, "umpires", u.id)));
  claims.forEach((c) => batch.delete(at(base, "courtClaims", c.id)));
  await batch.commit();
  return code;
}
export const syncSettings = (base, { style, to }) => updateDoc(at(base, "private", "umpire"), { style, to }).catch(() => {});
export const assignCourt = (base, courtId, umpire) => setDoc(at(base, "courtClaims", courtId), { uid: umpire.id, name: umpire.name });

// ---- Umpire (volunteer or manager)
export const joinAsUmpire = (base, uid, { code, name }) =>
  setDoc(at(base, "umpires", uid), { code, name: name.trim().slice(0, 40), at: Date.now() });
export const readOwnRecord = async (base, uid) => (await getDoc(at(base, "umpires", uid))).data() || null;
export const readSettings = async (base) => (await getDoc(at(base, "private", "umpire"))).data();
// A claim is a create: the rules refuse it when someone already holds the court.
export const claimCourt = (base, courtId, uid, name) => setDoc(at(base, "courtClaims", courtId), { uid, name });
export const releaseCourt = (base, courtId) => deleteDoc(at(base, "courtClaims", courtId));
// ponytail: last write wins if two scorers tap at the same moment (a manager and a volunteer on one court); a
// transaction would fix that but fails offline, which a gym with weak wifi would hit more often.
export const writeScore = (base, courtId, score) => updateDoc(at(base, "courts", courtId), { score });
```

- [ ] **Step 4: `src/hooks/useUmpireLink.js`**

```js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// The host's own view of the umpire link's code and settings (owner / managers only; null code = not created yet).
export function useUmpireLink(base) {
  const key = base ? base.join("/") : "";
  const [state, setState] = useState({ code: null, style: null, to: null, ready: false });
  useEffect(() => {
    if (!firebaseConfigured || !key) return undefined;
    return onSnapshot(doc(db, ...key.split("/"), "private", "umpire"),
      (s) => setState({ code: s.data()?.code || null, style: s.data()?.style || null, to: s.data()?.to || null, ready: true }),
      () => setState({ code: null, style: null, to: null, ready: true }));
  }, [key]);
  return state;
}
```

- [ ] **Step 5: `npm run build` passes. Commit** the four files.

---

### Task 5: Score keeper component and the manager's Score button

Needs Task 0 answered (edits `Dashboard.jsx`, `QueueApp.jsx`, `styles.css`). Invoke the design skills first. This task builds the one screen both managers and volunteers use.

**Files:**
- Create: `src/components/ScoreKeeper.jsx` (exports default `ScoreKeeper` and named `ScoreLine`)
- Modify: `src/views/Dashboard.jsx` (Score button, score line, "Record" banner, modal)
- Modify: `src/QueueApp.jsx` (pass `onScore`, `claims`)
- Modify: `src/styles.css` (`.scorekeeper*`, `.court-score*`)

**Interfaces:**
- Consumes: Task 1 functions, `writeScore` (Task 4), `useDocs` (`hooks/useLiveDocs.js`), `Modal`.
- Produces:
  - `<ScoreKeeper court players settings onScore={(score)=>} onConfirm={(side)=>}? />`: `settings = { style, to, singles }`; `onConfirm` omitted for a volunteer (shows "The host will record it").
  - `<ScoreLine score />`: compact `7 - 4 - 2` with the serving team marked, used on the Dashboard card and the Live Board.
  - Dashboard `Court` props `claims` (array of `{ id: courtId, uid, name }`) and `onScore(courtId, score)`.

- [ ] **Step 1: `ScoreKeeper.jsx`.** Behavior, top to bottom (use `liveScore(court, settings)` as the current score; every action calls `onScore(next)` with the new score, nothing is kept in local state besides which panel is open):
  1. Court name and `call(score)` very large, with "Team N serving" (side-out) beneath, and a `Game point - Team N` / `Team N wins 11-7` banner from `gamePoint` / `winner` / `finalText`.
  2. Two columns (stacked on a phone) in team colors: the team's player names (`players` lookup by `court.teamA` / `court.teamB`, plain names) and a big **Rally won** button, `background: var(--team1)` / `var(--team2)`, `color: var(--on-team1)` / `var(--on-team2)`, min height 72 px. Disabled when `winner(score)`.
  3. Row: **Undo** (`.outline`, disabled when `score.log.length === 0`), and when `t1 + t2 === 0 && log.length === 0` a "Team 2 serves first" toggle (`firstServe`).
  4. `<details>` **Adjust score**: for each team `-` / `+` buttons using `adjust`.
  5. When `winner(score)`: a panel "Team N wins 11-7". With `onConfirm`: a `.primary` **Confirm result** (`onConfirm(winner === 1 ? "A" : "B")`) and the Undo above stays available for a mistake. Without it: "Game over. The host will record the result."
  6. Court with no players (`teamA` and `teamB` empty): render only "No match on this court yet." and nothing scoreable.

  `ScoreLine({ score })`: `<span className="score-line"><b className="t1">{score.t1}</b> – <b className="t2">{score.t2}</b></span>` plus, when side-out and not singles, a small `Team N serving · server M`; `winner(score)` adds a trophy-free "Final". Keep it presentational (no handlers).

  Style: tokens only, 44 px minimum touch targets, no horizontal scroll at 390 px, `font-variant-numeric: tabular-nums` on numbers.

- [ ] **Step 2: Dashboard `Court`.** Add props `claims` and `onScore`. In `.court-top` after the timer nothing changes. Below the `.teams` block and above `.winrow` (inside the non-empty branch) add:

```jsx
          {sc && (
            <div className="court-score">
              <ScoreLine score={sc} />
              {done ? (
                <button className="primary" onClick={() => win(c.id, done === 1 ? "A" : "B", finalText(sc))}>
                  Record: Team {done} won {finalText(sc)}
                </button>
              ) : null}
            </div>
          )}
          <div className="court-umpire">
            <button className="outline" onClick={() => setScoring(true)}><Hash size={14} /> {sc ? "Score" : "Start score"}</button>
            {claim && <span>Umpire: {claim.name}</span>}
          </div>
```

with, near the top of `Court`:

```js
  const [scoring, setScoring] = useState(false);
  const claim = claims.find((x) => x.id === c.id);
  const sc = c.score && c.score.start === c.start ? c.score : null; // an old match's score never shows
  const done = sc ? winner(sc) : 0;
```

(import `Hash` from lucide-react, `ScoreLine`, `winner`, `finalText`). At the end of `Court`'s returned JSX add the manager modal, shown only while `scoring`:

```jsx
      {scoring && (
        <Modal title={c.name || `Court ${c.courtNumber}`} label="SCORE" close={() => setScoring(false)}>
          <ScoreKeeper court={c} players={players} settings={scoreSettings}
            onScore={(next) => onScore(c.id, next)}
            onConfirm={(side) => { setScoring(false); win(c.id, side, finalText(liveScore(c, scoreSettings))); }} />
        </Modal>
      )}
```

`scoreSettings` is `{ style: rules.scoreStyle, to: rules.scoreTo, singles: session.format === "Singles" }`, built once in `Dashboard` and passed to `Court` as a prop (`Dashboard` already has `rules` and `session`; confirm the prop names in `Dashboard`'s signature and add them if missing). `Dashboard` passes `claims`, `scoreSettings` and `onScore` to each `<Court>` and takes `claims`, `onScore` from `QueueApp`.

- [ ] **Step 3: `QueueApp`.** Add `const claims = useDocs([...base, "courtClaims"]);` (import `useDocs` from `./hooks/useLiveDocs`; this works for both bases: the owner/manager reads it) and `const scoreCourt = (courtId, score) => writeScore(base, courtId, score).catch(() => notify("Couldn't save the score. Check your connection.", 4000));` (import `writeScore` from `./utils/umpireData`). Pass `claims={claims}` and `onScore={scoreCourt}` to `<Dashboard>`.

- [ ] **Step 4: Styles** in `styles.css`: `.scorekeeper` (stack), `.scorekeeper-call` (3-4rem bold numbers), `.scorekeeper-teams` (two columns, one column under 560 px), `.scorekeeper-rally` (big team-colored button), `.court-score` / `.court-umpire` (small rows). Use `color-mix()` for tints like the rest of the file, no raw hex.

- [ ] **Step 5: Verify in the emulator** (`npm run emulators`, `npm run dev:emu`, `node scripts/seed-queue.mjs` for `sq1@demo.test`): open a live court, tap Score, tap Rally won for each team and confirm the called score follows side-out (0 - 0 - 2, a point, server change, side out), Undo, Adjust, and play to 11: Confirm records the win, the court rotates, the Match Log row shows "11-7", and the toast Undo restores the court. Plain "Team 1 Wins" still works. Screenshot at 390 px and desktop.
- [ ] **Step 6: Commit** (check `git diff --stat`, Task 0 step 2).

---

### Task 6: Host's Umpires panel (link, QR, switch, assign, new link)

**Files:**
- Create: `src/components/UmpireModal.jsx`
- Modify: `src/views/Dashboard.jsx` ("Umpires" button in the Live Courts header)
- Modify: `src/QueueApp.jsx` (state, the modal, quick-session switch)

**Interfaces:**
- Consumes: `useUmpireLink`, `createLink`, `renewLink`, `syncSettings`, `assignCourt`, `releaseCourt` (Task 4), `umpireUrl`, `useDocs`, `QrCode`, `Modal`, `ConfirmDialog`.
- Produces: `<UmpireModal base kind courts claims umpiresOn settings onToggle close notify />` where `kind` is `"quick" | "event"`, `umpiresOn` is the quick session's `session.umpireOn`, `settings = { style, to }`, `onToggle(boolean)` writes `umpireOn` (quick only).

- [ ] **Step 1: Build `UmpireModal`.** Content, in order:
  1. Quick session only: a switch row **Allow volunteer umpires** (reuse the Settings row/toggle look; off by default). While off, show the explanation "Volunteers can't open the link until you turn this on" and hide everything below except the switch.
  2. If `useUmpireLink(base).code` is null: a `.primary` **Create umpire link** (`createLink(base, settings)`).
  3. Else: the link in a read-only input with a Copy button (same behavior as `ShareModal`: `navigator.clipboard`, fall back to `select()` + `execCommand`), a `QrCode` (`value={url}`, `size={168}`, `label="QR code for the umpire link"`), and **New link** (`.outline`) opening a `ConfirmDialog` ("Every old link stops working and every volunteer umpire is signed off their court. Share the new link."), confirm = `renewLink(base, { ...settings, umpires, claims })`.
  4. A court list: each court "Court 1" with its claim (`Sam` + **Release**) or "Free" plus a `<select>` **Assign** listing registered umpires (`useDocs([...base, "umpires"])`, by name; choosing one calls `assignCourt`). Releasing calls `releaseCourt`.
  5. `useEffect` on open: when a code exists, `syncSettings(base, settings)` so volunteers use the current style and target.

  Errors from writes: `notify("Couldn't ...")`.

- [ ] **Step 2: Wire it.** `Dashboard`'s "Live Courts" `heading-actions` gets an **Umpires** `.outline` button (icon `UserCheck`) calling `onOpenUmpires`; `QueueApp` holds `showUmpires` state, renders `<UmpireModal>` beside the other modals, and for the quick session `onToggle={(on) => updateDoc(at(), { umpireOn: on })}` with `umpireOn={session.umpireOn === true}`.
- [ ] **Step 3: Verify** (emulator): create the link, QR renders, copy works, New link changes the code and clears registrations, quick-session switch toggles and persists. 390 px screenshot.
- [ ] **Step 4: Commit** (diff check).

---

### Task 7: The volunteer's umpire page

**Files:**
- Create: `src/Umpire.jsx`
- Modify: `src/utils/route.js` (`/umpire` -> `"umpire"`), `src/utils/route.check.mjs` (a case)
- Modify: `src/main.jsx` (lazy page `umpire: Umpire`)
- Modify: `src/styles.css` (page layout, small)

**Interfaces:**
- Consumes: `umpireTarget` (Task 4), `umpireData.js` (Task 4), `useDocs`, `ScoreKeeper` (Task 5), `auth` / `onAuthStateChanged` / `signInAnonymously` (as `useClub.js` does, never signing out a real account).
- Produces: the route `routeOf("/umpire") === "umpire"`; the default export `Umpire` page.

- [ ] **Step 1: Route.** In `routeOf` add `if (path === "/umpire") return "umpire";` next to `/live`; add `assert.equal(routeOf("/umpire"), "umpire")` (and with a trailing slash) to `route.check.mjs`; run `node src/utils/route.check.mjs`. In `main.jsx`: `const Umpire = lazy(() => import("./Umpire"));` and `const pages = { live: LiveBoard, "open-play": OpenPlay, quick: QuickSession, umpire: Umpire };`.
- [ ] **Step 2: `Umpire.jsx`** - one component, a small state machine (`status`): 
  1. `target = umpireTarget(window.location.search)`; null -> message "This umpire link is incomplete. Ask the host to share it again."
  2. Auth: `onAuthStateChanged`; no user -> `signInAnonymously(auth)` (an `auth/operation-not-allowed` / `admin-restricted-operation` error shows the same "anonymous sign-in must be on" text `useClub` uses).
  3. Name form (stored in `localStorage` `courtflow.umpireName`, wrapped in try/catch): "Your name", **Start umpiring**.
  4. Join: `readOwnRecord(base, uid)`; when it exists with this code skip, else `joinAsUmpire(base, uid, { code, name })`; then `settings = await readSettings(base)`. Any permission error here (and later listener errors that come back empty with `joined` true) -> **"This umpire link is no longer active."** with "Ask the host for a new link." (covers a renewed code, an ended game, the quick-session switch off).
  5. Data: `courts = useDocs([...base, "courts"])` (sorted by `courtNumber`), `players = useDocs([...base, "players"])`, `claims = useDocs([...base, "courtClaims"])`, all only after joining. Do not use `useSessionData` (it waits on the event doc, which a volunteer can't read).
  6. Picker (no claim of mine): a card per court: name, the four names (plain), and **Claim** if free; "Taken by Lee" otherwise. Claim -> `claimCourt(...)`; a rejection -> toast text "Someone else just took that court." Courts with a missing doc don't appear.
  7. Scoring (I hold a claim): header with court name and **Release court**; `<ScoreKeeper court players settings={{ style: settings.style, to: settings.to, singles: court.teamA.length === 1 && court.teamB.length === 1 }} onScore={(s) => writeScore(base, court.id, s)} />` with no `onConfirm`. A court with no players shows "No match on this court yet." and the claim stays. A claimed court that disappeared drops back to the picker.
  8. Layout: full-height phone-first column, max width 520 px centered, no sidebar, the CourtFlow logo small at the top. Theme: the page imports `styles.css` already; apply the saved theme the same way the Live Board does (`applyTheme(getGlobalTheme())`, as `LiveBoard.jsx` does; copy its two lines).
- [ ] **Step 3: Verify** with two browser contexts against the emulators: host creates a link (Task 6), volunteer A opens it, joins, claims Court 1; volunteer B sees "Taken by A" and a forced second claim is refused; A scores, the Dashboard court card updates live; New link -> A sees "no longer active"; a mangled link (`?code=x` only) shows the incomplete message; the page works at 390 px.
- [ ] **Step 4: Commit.**

---

### Task 8: Live Board shows the score

Needs Task 0 answered (edits `LiveBoard.jsx`).

**Files:**
- Modify: `src/LiveBoard.jsx` (`LiveCourt`)
- Modify: `src/styles.css` (`.live-score`)

**Interfaces:** Consumes `ScoreLine` (Task 5), `winner` (Task 1).

- [ ] **Step 1:** In `LiveCourt`, after `.teams` (non-empty branch) add `{sc && <div className="live-score"><ScoreLine score={sc} /></div>}` with `const sc = c.score && c.score.start === c.start ? c.score : null;`. Make `.live-score` large (the Live Board is read from a distance): number size about 2.2rem, team-colored numbers via `var(--team1)` / `var(--team2)`.
- [ ] **Step 2: Verify** `/live?club=<quick session uid>` while scoring on another tab: the score updates live and disappears when the result is recorded. `npm run build`.
- [ ] **Step 3: Commit** (diff check). Per-event Live Boards are step 4 of the accounts work; this shows the score there too once that page renders courts with `LiveCourt`.

---

### Task 9: Docs, spec sync, final verification

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-umpire-scoring-design.md`
- Modify: `CLAUDE.md` (one bullet in the Settings-backlog "Already built" list; `git diff` first: it has uncommitted edits of someone else, Task 0)
- Optional: `src/data/help.js` is guarded by `help.check.mjs`; do not touch unless a queue sentence changed (none did).

- [ ] **Step 1: Sync the spec** with what was built: link is `/umpire?club=C&event=E&code=K` or `?session=S&code=K`; the score also carries `singles`; **there is no `score.final`**: a finished game is read from the score itself (`winner(score)`), the Dashboard court card shows "Record: Team N won 11-7" for any finished score and a volunteer cannot record; `private/umpire` holds `{ code, style, to }` and is re-synced when the host opens the Umpires panel; a registered umpire may `get` only their own `umpires/{uid}`; New link also deletes registrations and claims.
- [ ] **Step 2: CLAUDE.md bullet** (same style as the others): umpire scoring, files (`utils/scoring.js` + check, `utils/umpire.js` + check, `utils/umpireData.js`, `components/ScoreKeeper.jsx`, `components/UmpireModal.jsx`, `Umpire.jsx` at `/umpire`), data paths (`private/umpire`, `umpires/{uid}`, `courtClaims/{courtId}`, `score` on the court), the settings (`rules.scoreStyle`, `rules.scoreTo`), test `tests/umpire.test.mjs`, "rules must be re-published", and what is not built (several umpires per court, timeouts, best-of-3, per-event Live Board score until step 4).
- [ ] **Step 3: Run everything fresh** (`superpowers:verification-before-completion`): `node src/utils/scoring.check.mjs && node src/utils/umpire.check.mjs && node src/utils/route.check.mjs && node src/utils/rotationModes.check.mjs && node src/utils/help.check.mjs`, `npm run test:rules`, `npm run build`. Read the output; do not claim success from memory.
- [ ] **Step 4: Browser pass** with `webapp-testing` / `agent-browser` at 390 px and desktop for the manager modal, Umpires panel, volunteer page (two contexts) and Live Board; fix what the screenshots show.
- [ ] **Step 5: Commit** docs, then tell the owner the rules must be published (and that the quick session also needs Anonymous sign-in on, which it already does).
