# Run the Game on an Event Implementation Plan (Step 3a)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host opens an event, taps "Proceed to game", ticks who is here, and runs the existing queue (courts, check-in, winners, costs, stats) scoped to that event. "Play now" starts a walk-in game with no booking. "End game" closes it without wiping anything, and it can be reopened. The quick session at `/club` keeps working unchanged.

**Architecture:** The queue app is only tied to the path `sessions/{id}`. Make the path a parameter (`base`, an array like `["accounts", uid, "events", id]`): the three data hooks take it, and the ~40 writes in `App.jsx` go through two helpers (`at`, `col`). `App.jsx` becomes `QueueApp` with two thin wrappers: `Club.jsx` (quick session, `/club`) and `Game.jsx` (`/event/:id/game`). Game rules and data shaping live in one pure, unit-checked module (`utils/gameSession.js`); Firestore wiring lives in `useGameActions`.

**Tech Stack:** React 19, Vite, Firebase Auth + Firestore, lucide-react, Firestore emulator + `@firebase/rules-unit-testing` (already set up).

**Spec:** `docs/superpowers/specs/2026-10-07-event-game-design.md` (parent: `2026-10-06-accounts-and-events-design.md`). Builds on branch `feat/accounts-hub` after step 2 (commit `8d680d7`).

## Global Constraints

- Every color is a token on `:root` in `src/styles.css` (`var(--accent)`, `var(--line)`, `var(--hover)`, `var(--muted)`). Never raw hex. (CLAUDE.md)
- No avatar-initial badges next to names. Plain names only.
- Money shows through `money()`, times through `formatHM` / `formatTime` / `formatDay` in `utils/format.js`.
- No new dependencies. No router library.
- Copy: sentence case, active voice, errors say what went wrong and what to do. One name per action across screens ("Proceed to game", "Add to game", "End game", "Reopen game").
- **Modules that a `*.check.mjs` imports must write relative imports with the `.js` extension** (`from "./bookings.js"`), because plain Node does not resolve extensionless paths. Vite is fine with either. (`src/utils/gameSession.js` and `src/utils/paths.js` follow this.)
- Do not use regexes or backslashes inside shell heredoc scripts that edit files; use plain-string `split`/`join` or the Edit tool. After a scripted edit, grep the file to confirm it.
- `dist/` is tracked: after every `npx vite build`, run `git checkout -- dist && git clean -fdq dist` and never commit a rebuild.
- `.playwright-mcp/` is tracked in this repo. Never `rm -rf` it; never `git add` it.
- Commit steps assume you have approved committing. End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never deploy, push or merge. Publishing `firestore.rules` is the owner's action (this plan changes no rules).
- Browser checks create real data in the live Firebase project through a throwaway account. Delete that account at the end (Settings → Delete account), which also exercises the delete cascade.

## Review Focus

Inputs and conditions the spec implies but the happy path will not exercise, most likely first:

1. **The quick session regresses.** Every write in `App.jsx` is touched by the path refactor. Pinned by the `paths.check.mjs` unit check (Task 1) and a full browser pass of `/club` (add, check in, fill, win, undo, cost, End Session archives, erase) in Tasks 1 and 7.
2. **Starting or adding twice.** "Add to game" on a live event must not duplicate a player, reset one who already has games, or double the booking cost entry, and must keep paid toggles the host set on the Cost tab. Pinned by `gameSession.check.mjs` (Task 2): `playersToAdd` is idempotent and `bookingCostEntry` preserves `existing.paid`.
3. **Walk-in and ended events leaking onto the public booking page.** A "Play now" event has `maxPlayers: 0` and would show as a joinable "Full" card; an event the host ended early would still read "upcoming". Pinned by `isListed` / `isOver` checks (Task 2) and used by `OpenPlay.jsx` and `Host.jsx` (Tasks 5, 7).
4. **Deleting an event or the account with a game leaves data behind.** Players hold names and the cost entry holds who paid. Pinned by the extended `tests/cascade.test.mjs` (Task 4).
5. **Direct links to the game.** `/event/:id/game` for an unknown event, an event that has not started, or one that has ended must show a message and a way back, not a blank page; signed out, sign-in must return to the same path. Pinned by `route.check.mjs` (Task 3) and the browser steps in Task 7.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/paths.js` (new), `paths.check.mjs` | `sessionBase(uid)`, `eventBase(uid, eventId)`. |
| `src/hooks/useSessionData.js`, `useCosts.js`, `useMatchLog.js` (modify) | Take a `base` array instead of a session id. |
| `src/App.jsx` → `src/QueueApp.jsx` (git mv, modify) | The queue app on one `base`; `kind` and event-mode props. |
| `src/Club.jsx` (new) | `/club` wrapper: `useClub`, then `QueueApp`. |
| `src/Game.jsx` (new) | `/event/:id/game` wrapper: gates on event status, builds the merged session, `QueueApp`. |
| `src/main.jsx`, `src/LiveBoard.jsx` (modify) | Use `Club` and `sessionBase`. |
| `src/utils/gameSession.js` (new), `gameSession.check.mjs` | Pure game logic (session merge, start fields, pick list, players to add, cost entry, Play now event, summary). |
| `src/utils/bookings.js` (modify), `bookings.check.mjs` | `isOver`, `isListed`. |
| `src/utils/route.js` (modify), `route.check.mjs` | `game` route; `eventIdOf` also matches `/event/<id>/game`. |
| `src/utils/accountData.js` (modify), `tests/cascade.test.mjs`, `tests/rules.test.mjs` | Cascade covers game subcollections; rules tests pin them owner-only. |
| `src/hooks/useEventPlayers.js` (new) | An event's players, for the event page. |
| `src/hooks/useGameActions.js` (new) | `startGame`, `playNow`, `endGame`, `reopenGame`. |
| `src/components/GamePickModal.jsx` (new) | The "Proceed to game" pick list. |
| `src/views/EventPage.jsx`, `src/views/Host.jsx`, `src/AccountApp.jsx` (modify) | Buttons, game line, Play now, route `game`. |
| `src/components/Sidebar.jsx`, `Topbar.jsx` (modify) | Event-mode labels, hidden tabs, back link. |
| `src/OpenPlay.jsx` (modify) | List only `isListed` events. |
| `src/styles.css` (modify) | Pick list styles. |
| `CLAUDE.md`, the 3a spec (modify) | Document the game; correct the spec's rules claim. |

## Before you start

- [ ] The branch is `feat/accounts-hub` and `git status` is clean. Run `npm run test:rules` once and confirm `rules: all assertions passed` and `cascade: ok`.
- [ ] **One correction to the spec, made in this plan (Task 4):** Firestore rules do not cascade into subcollections. The spec said event subcollections inherit public read; they do not. `players`, `courts`, `matchLog` and `costs` under an event are owner-only through `accounts/{uid}/{document=**}`, which is all the host's game needs. Public read opens in step 4 (Live Board), not now. Task 4 pins this with tests and fixes the spec text.
- [ ] No rules change in this plan, so nothing needs publishing for it.

---

### Task 1: Base paths, parameterised hooks, QueueApp, Club (quick session unchanged)

**Files:**
- Create: `src/utils/paths.js`, `src/utils/paths.check.mjs`, `src/Club.jsx`
- Rename: `src/App.jsx` → `src/QueueApp.jsx` (`git mv`)
- Modify: `src/hooks/useSessionData.js`, `src/hooks/useCosts.js`, `src/hooks/useMatchLog.js`, `src/LiveBoard.jsx`, `src/main.jsx`, `src/QueueApp.jsx`

**Interfaces:**
- Produces: `sessionBase(uid): string[] | null`, `eventBase(uid, eventId): string[] | null`; `useSessionData(base)`, `useCosts(base)`, `useMatchLog(base, count?)` (null base = nothing loaded); `<QueueApp base onEndSession onErase />`; `<Club />`.

- [ ] **Step 1: Write the failing check**

Create `src/utils/paths.check.mjs`:

```js
// Self-check for session base paths. Run: node src/utils/paths.check.mjs
import assert from "node:assert";
import { eventBase, sessionBase } from "./paths.js";

assert.deepEqual(sessionBase("u1"), ["sessions", "u1"]);
assert.deepEqual(eventBase("u1", "e1"), ["accounts", "u1", "events", "e1"]);
// Not known yet (still signing in, or no event chosen): no base, so hooks load nothing.
assert.equal(sessionBase(null), null);
assert.equal(sessionBase(""), null);
assert.equal(eventBase("u1", undefined), null);
assert.equal(eventBase(undefined, "e1"), null);

console.log("paths.check: ok");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/utils/paths.check.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/utils/paths.js`.

- [ ] **Step 3: Implement paths and the hooks**

Create `src/utils/paths.js`:

```js
// A "base" is the Firestore path (an array) of the document that acts as one queue
// session. Its subcollections are players, courts, matchLog and costs. A quick session is
// sessions/{uid}; a game is accounts/{uid}/events/{eventId}. Null while the ids aren't known.
export const sessionBase = (uid) => (uid ? ["sessions", uid] : null);
export const eventBase = (uid, eventId) => (uid && eventId ? ["accounts", uid, "events", eventId] : null);
```

Replace `src/hooks/useSessionData.js` with:

```js
import { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { seedSession } from "../data/constants";

// `base` is the path of the session document (utils/paths.js). The hook keys on its
// joined string, so a new array with the same path does not resubscribe.
export function useSessionData(base) {
  const key = base ? base.join("/") : "";
  const [session, setSession] = useState(seedSession);
  const [players, setPlayers] = useState([]);
  const [courts, setCourts] = useState([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured || !key) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const path = key.split("/");
    // busy only clears once all three listeners have delivered their first
    // snapshot, so the loading screen doesn't hand off to a still-empty UI.
    const loaded = { session: false, players: false, courts: false };
    const checkLoaded = () => {
      if (loaded.session && loaded.players && loaded.courts) setBusy(false);
    };
    const unsubS = onSnapshot(doc(db, ...path), (s) => {
      if (s.exists()) setSession(s.data());
      loaded.session = true;
      checkLoaded();
    });
    const pq = query(collection(db, ...path, "players"), orderBy("createdAt"));
    const cq = query(collection(db, ...path, "courts"), orderBy("courtNumber"));
    const unsubP = onSnapshot(pq, (s) => {
      setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      loaded.players = true;
      checkLoaded();
    });
    const unsubC = onSnapshot(cq, (s) => {
      setCourts(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      loaded.courts = true;
      checkLoaded();
    });
    return () => { unsubS(); unsubP(); unsubC(); };
  }, [key]);

  return { session, setSession, players, courts, busy };
}
```

Replace `src/hooks/useCosts.js` with:

```js
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export function useCosts(base) {
  const key = base ? base.join("/") : "";
  const [costs, setCosts] = useState([]);

  useEffect(() => {
    if (!firebaseConfigured || !key) {
      setCosts([]);
      return;
    }
    const q = query(collection(db, ...key.split("/"), "costs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (s) => setCosts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [key]);

  return costs;
}
```

Replace `src/hooks/useMatchLog.js` with:

```js
import { useEffect, useState } from "react";
import {
  collection, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export function useMatchLog(base, count = 20) {
  const key = base ? base.join("/") : "";
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!firebaseConfigured || !key) {
      setLog([]);
      return;
    }
    const q = query(
      collection(db, ...key.split("/"), "matchLog"),
      orderBy("recordedAt", "desc"),
      limit(count)
    );
    const unsub = onSnapshot(q, (s) => setLog(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [key, count]);

  return log;
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `node src/utils/paths.check.mjs`
Expected: `paths.check: ok`.

- [ ] **Step 5: Rename `App.jsx` and replace every hard-coded path**

```bash
git mv src/App.jsx src/QueueApp.jsx
```

Run this script once (plain-string replacements only; it fails loudly if a pattern is missing):

```bash
node - <<'EOF'
const fs = require("fs");
const f = "src/QueueApp.jsx";
let s = fs.readFileSync(f, "utf8");
const crlf = s.includes("\r\n");
s = s.split("\r\n").join("\n");
const swap = (from, to) => {
  if (!s.includes(from)) throw new Error("missing: " + from);
  s = s.split(from).join(to);
};
swap('doc(db, "sessions", SESSION_ID, ', "at(");
swap('doc(db, "sessions", SESSION_ID)', "at()");
swap('collection(db, "sessions", SESSION_ID, ', "col(");
fs.writeFileSync(f, crlf ? s.split("\n").join("\r\n") : s);
EOF
grep -n 'SESSION_ID\|"sessions"' src/QueueApp.jsx
```

Expected: the grep prints only the lines that are edited by hand in the next steps (the header, `handleErase`/`eraseSession`, the `!club` block, `Stats`, `ShareModal`).

Now the hand edits in `src/QueueApp.jsx` (use the Edit tool; old text exactly as shown):

1. Delete the line `import { useClub } from "./hooks/useClub";`.
2. Replace

```jsx
export default function App() {
  const {
    club, error: clubError, endSession, eraseSession,
  } = useClub();
  const SESSION_ID = club?.id;
  const [tab, setTab] = useState("dashboard");
  const { session, players, courts, busy } = useSessionData(SESSION_ID);
  const costs = useCosts(SESSION_ID);
  const matchLog = useMatchLog(SESSION_ID);
```

with

```jsx
// The queue app on one session. `base` is the Firestore path of the document that holds it
// (utils/paths.js): the quick session at /club today. Every read and write goes through
// `at` (a document) and `col` (a collection) so the same code runs on any base.
export default function QueueApp({ base, onEndSession, onErase }) {
  const at = (...rest) => doc(db, ...base, ...rest);
  const col = (name) => collection(db, ...base, name);
  const [tab, setTab] = useState("dashboard");
  const { session, players, courts, busy } = useSessionData(base);
  const costs = useCosts(base);
  const matchLog = useMatchLog(base);
```

3. Replace `if (club && !busy) applyTheme(display);` with `if (!busy) applyTheme(display);` and change the comment above it to start `// Still loading, display is just the defaults; ...` (drop "Signed out or").
4. In `handleErase`, replace `await eraseSession();` with `await onErase();`.
5. Delete the whole `if (!club) { ... }` block (the one that renders `clubError` or "Starting your session…") that sits just before `if (busy)`.
6. Replace `<Stats players={players} exportCsv={exportCsv} sessionId={SESSION_ID} />` with `<Stats players={players} exportCsv={exportCsv} sessionId={base[1]} />`.
7. In the `ShareModal` url, replace `club=${SESSION_ID}` with `club=${base[1]}`.
8. In the End Session confirm, replace `endSession()` (the call just before `.then(() => { setTab("dashboard");`) with `onEndSession()`.

- [ ] **Step 6: Club wrapper, entry point, Live Board**

Create `src/Club.jsx`:

```jsx
import { useClub } from "./hooks/useClub";
import { sessionBase } from "./utils/paths";
import QueueApp from "./QueueApp";

// The quick session at /club: the classic queue app on sessions/{uid}, no booking, no login.
export default function Club() {
  const { club, error, endSession, eraseSession } = useClub();
  if (!club) {
    return error ? (
      <div className="loading">{error}</div>
    ) : (
      <div className="loading"><span className="spinner" />Starting your session…</div>
    );
  }
  return <QueueApp base={sessionBase(club.id)} onEndSession={endSession} onErase={eraseSession} />;
}
```

In `src/main.jsx` change `const App = lazy(() => import("./App"));` to `const App = lazy(() => import("./Club"));`.

In `src/LiveBoard.jsx` add `import { sessionBase } from "./utils/paths";` and change the three hook calls to:

```jsx
  const { session, players, courts, busy } = useSessionData(sessionBase(clubId));
  const costs = useCosts(sessionBase(clubId));
  const matchLog = useMatchLog(sessionBase(clubId));
```

- [ ] **Step 7: Verify the build and the code**

Run: `node src/utils/paths.check.mjs && npx vite build`
Expected: `paths.check: ok` and a successful build. Then `git checkout -- dist && git clean -fdq dist`.

Run: `grep -rn 'SESSION_ID\|"sessions"' src/QueueApp.jsx`
Expected: no output.

- [ ] **Step 8: Browser regression of the quick session (Review Focus 1)**

Run `npx vite --port 5200`, open `http://localhost:5200/club` (Anonymous sign-in must be on; it is). Check, in order:
1. "Starting your session…" then the Dashboard with 2 courts.
2. Add Player four times (A, B, C, D, all checked in). They show in the queue.
3. Dashboard "Fill open seats" (auto fill): Court 1 has all four.
4. Click a team's Win button: toast "Court 1 rotated." (or "Winners stay…") with Undo. Click Undo within 10s: "Result on Court 1 undone." and the players' games return to 0.
5. Cost tab: add an entry; toast "Cost entry saved."
6. Record a win again, then Sidebar "End Session" → confirm. Toast "Session ended. Stats are saved to Past Sessions." Stats → Past Sessions has one entry; everyone is checked out.
7. Settings → "Erase this session" → confirm → fresh session.
8. Open `/live?club=<uid>` (uid from the share dialog URL before erasing): the Live Board loads. Browser console shows no errors.

- [ ] **Step 9: Commit**

```bash
git add src/utils/paths.js src/utils/paths.check.mjs src/hooks/useSessionData.js src/hooks/useCosts.js src/hooks/useMatchLog.js src/QueueApp.jsx src/Club.jsx src/main.jsx src/LiveBoard.jsx
git commit -m "refactor: queue app takes a session base path; /club wraps it" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(`git mv` already staged the rename; confirm `git status` shows `renamed: src/App.jsx -> src/QueueApp.jsx`.)

---

### Task 2: Pure game logic

**Files:**
- Create: `src/utils/gameSession.js`, `src/utils/gameSession.check.mjs`
- Modify: `src/utils/bookings.js`, `src/utils/bookings.check.mjs`

**Interfaces:**
- Consumes: `splitAttendees` from `bookings.js`; `seedSession` from `data/constants.js`.
- Produces (all pure):
  - `buildGameSession(account, event)`: the session object the queue sees.
  - `gameStartFields(account, now)`: `{ status: "live", startedAt, courts, format, mode, autoRotate }`.
  - `courtDocs(count, now)`: `[{ id: "court-N", data: { courtNumber, start, teamA: [], teamB: [] } }]`.
  - `gamePickList(event, players)`: `[{ id, name, group: "joined" | "waitlist", waitNo, paid, inGame }]`.
  - `playersToAdd(event, pickedIds, players, now)`: new player docs (with their `id`), idempotent.
  - `bookingCostEntry(event, inGameIds: Set, existing, now)`: the cost doc or `null`.
  - `floorQuarter(hm)`, `playNowEvent({ account, today, hm, timeZone, hostName, now })`, `gameSummary(players)`.
  - In `bookings.js`: `isOver(event, fallbackZone)`, `isListed(event, fallbackZone)`.

- [ ] **Step 1: Write the failing checks**

Create `src/utils/gameSession.check.mjs`:

```js
// Self-check for the pure game logic. Run: node src/utils/gameSession.check.mjs
import assert from "node:assert";
import {
  bookingCostEntry, buildGameSession, courtDocs, floorQuarter, gamePickList, gameStartFields,
  gameSummary, playNowEvent, playersToAdd,
} from "./gameSession.js";

const att = (id, joinedAt, paid = "unpaid") => ({ id, name: id.toUpperCase(), joinedAt, paid, method: "cash" });
const event = {
  id: "e1", title: "Saturday", fee: 150, durationMins: 120, maxPlayers: 2,
  attendees: [att("a", 1, "paid"), att("b", 2), att("c", 3, "refunded")],
};

// The event names the session; account-wide settings are layered on; the club name does not leak in.
const account = { clubName: "Club", rules: { winnersStay: true }, display: { theme: "dark" }, defaults: { courts: 3 } };
const s = buildGameSession(account, { ...event, courts: 3, format: "Doubles", mode: "Balanced" });
assert.equal(s.location, "Saturday");
assert.deepEqual(s.rules, { winnersStay: true });
assert.equal(s.display.theme, "dark");
assert.equal(s.courts, 3);
assert.equal(s.clubName, undefined);
assert.equal(buildGameSession({}, {}).location, "Open play");

// A game starts from the account's session defaults; bad values fall back.
assert.deepEqual(
  gameStartFields({ defaults: { courts: 3, format: "Singles", mode: "Skill Courts" } }, 5),
  { status: "live", startedAt: 5, courts: 3, format: "Singles", mode: "Skill Courts", autoRotate: true },
);
assert.deepEqual(
  gameStartFields({}, 5),
  { status: "live", startedAt: 5, courts: 2, format: "Doubles", mode: "Balanced", autoRotate: true },
);
assert.equal(gameStartFields({ defaults: { courts: "0" } }, 1).courts, 2);
assert.deepEqual(courtDocs(2, 9), [
  { id: "court-1", data: { courtNumber: 1, start: 9, teamA: [], teamB: [] } },
  { id: "court-2", data: { courtNumber: 2, start: 9, teamA: [], teamB: [] } },
]);

// The pick list: joined first, then the waitlist, each with its paid status; who is already in is flagged.
assert.deepEqual(
  gamePickList(event, [{ id: "a" }]).map((r) => [r.id, r.group, r.waitNo, r.paid, r.inGame]),
  [["a", "joined", 0, "paid", true], ["b", "joined", 0, "unpaid", false], ["c", "waitlist", 1, "refunded", false]],
);

// Review Focus 2: adding is idempotent and never touches someone already in the game.
const add = playersToAdd(event, ["a", "c", "zzz"], [{ id: "a" }], 100);
assert.deepEqual(add.map((p) => p.id), ["c"]); // a is in already; zzz is not an attendee
assert.equal(add[0].name, "C");
assert.equal(add[0].checked, false);
assert.equal(add[0].games, 0);
assert.deepEqual(playersToAdd(event, ["a"], [{ id: "a" }], 100), []);
const both = playersToAdd(event, ["c", "b"], [], 100);
assert.deepEqual(both.map((p) => p.id), ["b", "c"]); // joined order, not tick order
assert.ok(both[0].createdAt < both[1].createdAt);

// Review Focus 2: the booking cost entry covers who is in the game and keeps what the host toggled.
const c1 = bookingCostEntry(event, new Set(["a", "b"]), null, 50);
assert.equal(c1.total, 300);
assert.equal(c1.perPerson, 150);
assert.equal(c1.hours, 2);
assert.equal(c1.rate, 150);
assert.deepEqual(c1.playerIds, ["a", "b"]);
assert.deepEqual(c1.paid, { a: true, b: false });
assert.equal(c1.bookingId, "e1");
assert.equal(c1.label, "Saturday");
assert.equal(c1.createdAt, 50);
assert.equal(c1.visibleOnLive, false);
const c2 = bookingCostEntry(event, new Set(["a", "b", "c"]), { paid: { a: false, b: true }, visibleOnLive: true, createdAt: 10 }, 99);
assert.deepEqual(c2.paid, { a: false, b: true, c: false }); // host's toggles kept; refunded c is not paid
assert.equal(c2.visibleOnLive, true);
assert.equal(c2.createdAt, 10);
assert.equal(c2.total, 450);
assert.equal(bookingCostEntry({ ...event, fee: 0 }, new Set(["a"]), null, 1), null);
assert.equal(bookingCostEntry(event, new Set(), null, 1), null);

// Play now: today, the current quarter hour, no seats, a live game.
assert.equal(floorQuarter("17:52"), "17:45");
assert.equal(floorQuarter("00:05"), "00:00");
assert.equal(floorQuarter("09:15"), "09:15");
assert.equal(floorQuarter("23:59"), "23:45");
const pn = playNowEvent({ account: { defaults: { courts: 3 } }, today: "2026-10-08", hm: "17:52", timeZone: "Asia/Manila", hostName: "Club", now: 7 });
assert.equal(pn.title, "Play now");
assert.equal(pn.date, "2026-10-08");
assert.equal(pn.startTime, "17:45");
assert.equal(pn.durationMins, 240);
assert.equal(pn.walkIn, true);
assert.equal(pn.status, "live");
assert.equal(pn.courts, 3);
assert.equal(pn.startedAt, 7);
assert.equal(pn.maxPlayers, 0);
assert.equal(pn.fee, 0);
assert.deepEqual(pn.attendees, []);
assert.equal(pn.timeZone, "Asia/Manila");
assert.equal(pn.hostName, "Club");

// The event page's game line.
assert.deepEqual(gameSummary([{ checked: true, games: 3 }, { checked: false, games: 1 }, { checked: true, games: 0 }]), { players: 3, checkedIn: 2, matches: 2 });
assert.deepEqual(gameSummary([]), { players: 0, checkedIn: 0, matches: 0 });

console.log("gameSession.check: ok");
```

Append to `src/utils/bookings.check.mjs` before the final `console.log`, and add `isListed, isOver` to its import line:

```js
// Review Focus 3: ended or walk-in events never show as joinable on the public page.
assert.equal(isOver({ ...future, status: "scheduled" }, "UTC"), false);
assert.equal(isOver({ ...future, status: "ended" }, "UTC"), true); // ended early by the host
assert.equal(isOver(old, "UTC"), true);
assert.equal(isListed({ ...future, status: "scheduled" }, "UTC"), true);
assert.equal(isListed({ ...future, status: "live" }, "UTC"), true);
assert.equal(isListed({ ...future, status: "ended" }, "UTC"), false);
assert.equal(isListed({ ...future, walkIn: true }, "UTC"), false);
assert.equal(isListed(old, "UTC"), false);
```

(`old` and `future` are defined earlier in that file by step 2's time-zone checks.)

- [ ] **Step 2: Run them to verify they fail**

Run: `node src/utils/gameSession.check.mjs; node src/utils/bookings.check.mjs`
Expected: both FAIL with `does not provide an export named` / `ERR_MODULE_NOT_FOUND` (`gameSession.js`, `isOver`).

- [ ] **Step 3: Implement**

Append to `src/utils/bookings.js`:

```js

// Over = its scheduled time has passed in its own zone, or the host ended the game early.
export const isOver = (event, fallbackZone) => event.status === "ended" || hasEndedIn(event, fallbackZone);

// What the public booking page lists: not a walk-in, not over.
export const isListed = (event, fallbackZone) => !event.walkIn && !isOver(event, fallbackZone);
```

Create `src/utils/gameSession.js`:

```js
// Pure rules for running a game on an event. No Firestore here (that is useGameActions),
// so everything below is covered by gameSession.check.mjs.
import { seedSession } from "../data/constants.js";
import { splitAttendees } from "./bookings.js";

// What the queue app sees as `session`: the event doc (its game settings and title) with the
// account-wide settings layered on. QueueApp merges the DEFAULT_* values over these.
export function buildGameSession(account = {}, event = {}) {
  return {
    ...event,
    location: event.title || "Open play",
    rules: account.rules,
    costDefaults: account.costDefaults,
    live: account.live,
    display: account.display,
    defaults: account.defaults,
  };
}

// The settings a game starts with, from the account's Session defaults.
export function gameStartFields(account = {}, now) {
  const d = account.defaults || {};
  return {
    status: "live",
    startedAt: now,
    courts: Math.max(1, Math.round(Number(d.courts)) || seedSession.courts),
    format: d.format || seedSession.format,
    mode: d.mode || seedSession.mode,
    autoRotate: true,
  };
}

export const courtDocs = (count, now) => Array.from({ length: count }, (_, i) => ({
  id: `court-${i + 1}`,
  data: { courtNumber: i + 1, start: now, teamA: [], teamB: [] },
}));

// Everyone who can be brought in: the joined list, then the waitlist. `players` are the
// game's current player docs (their id is the attendee id), so already-in rows are flagged.
export function gamePickList(event, players = []) {
  const { confirmed, waitlist } = splitAttendees(event);
  const inGame = new Set(players.map((p) => p.id));
  const row = (a, group, waitNo) => ({
    id: a.id, name: a.name, group, waitNo, paid: a.paid || "unpaid", inGame: inGame.has(a.id),
  });
  return [
    ...confirmed.map((a) => row(a, "joined", 0)),
    ...waitlist.map((a, i) => row(a, "waitlist", i + 1)),
  ];
}

// New player docs for the ticked attendees who are not in the game yet, in joined order.
// Checked out: the host taps each in as they arrive. Idempotent, so "Add to game" is safe to repeat.
export function playersToAdd(event, pickedIds, players, now) {
  const have = new Set(players.map((p) => p.id));
  const picked = new Set(pickedIds);
  return (event.attendees || [])
    .filter((a) => picked.has(a.id) && !have.has(a.id))
    .map((a, i) => ({
      id: a.id, name: a.name, skill: 0, gender: "", checked: false,
      games: 0, wins: 0, losses: 0, createdAt: now + i, checkedAt: now + i,
    }));
}

// The one cost entry for the booking fee, covering the attendees now in the game. `existing`
// is the entry already saved (if any), so a later "Add to game" keeps the paid toggles the
// host set on the Cost tab and its Live Board visibility.
export function bookingCostEntry(event, inGameIds, existing, now) {
  const fee = event.fee || 0;
  const members = (event.attendees || []).filter((a) => inGameIds.has(a.id));
  if (fee <= 0 || !members.length) return null;
  const hours = (event.durationMins || 60) / 60;
  const total = fee * members.length;
  return {
    label: event.title, rate: total / hours, hours, courts: 1, total, perPerson: fee,
    playerIds: members.map((a) => a.id), bookingId: event.id,
    paid: Object.fromEntries(members.map((a) => [a.id, existing?.paid?.[a.id] ?? a.paid === "paid"])),
    visibleOnLive: existing?.visibleOnLive ?? false,
    createdAt: existing?.createdAt ?? now,
  };
}

// "17:52" -> "17:45".
export function floorQuarter(hm) {
  const [h, m] = hm.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(Math.floor(m / 15) * 15).padStart(2, "0")}`;
}

// An unscheduled "Play now" event: live from the start, no seats, no fee.
export function playNowEvent({ account, today, hm, timeZone, hostName, now }) {
  return {
    title: "Play now", date: today, startTime: floorQuarter(hm), durationMins: 240,
    maxPlayers: 0, fee: 0, level: "Any Level", notes: "", payInfo: "", attendees: [],
    walkIn: true, hostName, timeZone, createdAt: now,
    ...gameStartFields(account, now),
  };
}

// The event page's game line.
export function gameSummary(players) {
  const games = players.reduce((n, p) => n + (p.games || 0), 0);
  return {
    players: players.length,
    checkedIn: players.filter((p) => p.checked).length,
    matches: Math.round(games / 2),
  };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `node src/utils/gameSession.check.mjs && node src/utils/bookings.check.mjs`
Expected: `gameSession.check: ok`, `bookings.check: ok`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/gameSession.js src/utils/gameSession.check.mjs src/utils/bookings.js src/utils/bookings.check.mjs
git commit -m "feat: pure game logic (session merge, pick list, players to add, cost entry, Play now)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The game route

**Files:**
- Modify: `src/utils/route.js`, `src/utils/route.check.mjs`

**Interfaces:**
- Produces: `routeOf("/event/<id>/game")` returns `"game"`; `eventIdOf` returns `<id>` for both `/event/<id>` and `/event/<id>/game`.

- [ ] **Step 1: Write the failing checks**

Append to `src/utils/route.check.mjs` before the final `console.log`:

```js
// Review Focus 5: the game page is /event/<id>/game; anything deeper or lookalike is the hub.
assert.equal(routeOf("/event/abc123/game"), "game");
assert.equal(routeOf("/event/abc123/game/"), "game");
assert.equal(routeOf("/event/abc123/gamex"), "hub");
assert.equal(routeOf("/event/abc123/game/extra"), "hub");
assert.equal(routeOf("/event/abc123"), "event");
assert.equal(eventIdOf("/event/abc123/game"), "abc123");
assert.equal(eventIdOf("/event/abc%20x/game/"), "abc x");
assert.equal(eventIdOf("/event/abc123/gamex"), null);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/utils/route.check.mjs`
Expected: FAIL with an `AssertionError` on `routeOf("/event/abc123/game")` (`'hub' !== 'game'`).

- [ ] **Step 3: Implement**

Use the Edit tool on `src/utils/route.js`. Inside `routeOf`, directly after the line that returns `"event"`, add a line that returns `"game"` for a path made of `/event/`, one id segment, and `/game`. Replace the `eventIdOf` body so its pattern also accepts an optional trailing `/game`. After the edit the two functions read:

```js
  if (/^\/event\/[^/]+$/.test(path)) return "event";
  if (/^\/event\/[^/]+\/game$/.test(path)) return "game";
```

```js
export function eventIdOf(pathname) {
  const m = pathname.replace(/\/+$/, "").match(/^\/event\/([^/]+?)(?:\/game)?$/);
  return m ? decodeURIComponent(m[1]) : null;
}
```

Then read the file back and confirm the backslashes are present in all three regexes (`grep -n 'event' src/utils/route.js`).

- [ ] **Step 4: Run it to verify it passes**

Run: `node src/utils/route.check.mjs`
Expected: `route.check: ok`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/route.js src/utils/route.check.mjs
git commit -m "feat: game route /event/:id/game" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Rules pins and the delete cascade

**Files:**
- Modify: `src/utils/accountData.js`, `tests/cascade.test.mjs`, `tests/rules.test.mjs`, `docs/superpowers/specs/2026-10-07-event-game-design.md`

**Interfaces:**
- Consumes: `EVENT_SUBCOLLECTIONS` (used by `deleteAccountData` and `useEventActions.remove`).
- Produces: `EVENT_SUBCOLLECTIONS = ["requests", "players", "courts", "matchLog", "costs"]`.

- [ ] **Step 1: Extend the cascade test (it fails first)**

In `tests/cascade.test.mjs`, inside the seed loop (the `for (const e of ["e1", "e2"])` block, after the requests loop), add:

```js
    for (const sub of ["players", "courts", "matchLog", "costs"]) {
      await setDoc(doc(db, `accounts/u1/events/${e}/${sub}/x`), { n: 1 });
    }
```

After the `accounts/u2/events/e9/requests/r0` seed line add:

```js
  await setDoc(doc(db, "accounts/u2/events/e9/players/x"), { name: "Keep" });
```

After the existing `assert.equal(await count("accounts/u1/events/e2/requests"), 0);` line add:

```js
// Review Focus 4: the game's data goes too, with no orphans holding names or who paid.
for (const e of ["e1", "e2"]) {
  for (const sub of ["players", "courts", "matchLog", "costs"]) {
    assert.equal(await count(`accounts/u1/events/${e}/${sub}`), 0, `${e}/${sub} left behind`);
  }
}
```

and at the end, before `console.log("cascade: ok")`:

```js
assert.equal(await count("accounts/u2/events/e9/players"), 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:rules`
Expected: `rules: all assertions passed`, then FAIL with an `AssertionError` (`e1/players left behind`).

- [ ] **Step 3: Implement the cascade**

In `src/utils/accountData.js` replace the constant and its comment with:

```js
// Subcollections under each event: join requests, and the game's players, courts, matchLog
// and costs. Listed here so deleting an event or an account never orphans any of them.
export const EVENT_SUBCOLLECTIONS = ["requests", "players", "courts", "matchLog", "costs"];
```

- [ ] **Step 4: Pin the rules (these pass at once: they document existing behavior)**

In `tests/rules.test.mjs`, after the `// Join requests: ...` block ends (after the line `await assertSucceeds(deleteDoc(doc(reqCol(u1), "r2")));`), add:

```js

// Game data under an event (step 3a): the host writes it. Rules do not cascade into
// subcollections, so it is owner-only for now; step 4 opens read for the Live Board.
const g = (db, path) => doc(db, "accounts/u1/events/e1", path);
await assertSucceeds(setDoc(g(u1, "players/p1"), { name: "P", checked: false }));
await assertSucceeds(setDoc(g(u1, "courts/court-1"), { courtNumber: 1 }));
await assertSucceeds(setDoc(g(u1, "matchLog/m1"), { court: "Court 1" }));
await assertSucceeds(setDoc(g(u1, "costs/booking-e1"), { label: "Saturday" }));
await assertSucceeds(getDocs(collection(u1, "accounts/u1/events/e1/players")));
await assertFails(getDoc(g(anon, "players/p1")));
await assertFails(getDocs(collection(anon, "accounts/u1/events/e1/courts")));
await assertFails(getDoc(g(u2, "costs/booking-e1")));
await assertFails(setDoc(g(anon, "players/p2"), { name: "evil" }));
await assertFails(updateDoc(g(u2, "players/p1"), { name: "evil" }));
await assertFails(setDoc(g(legacy, "costs/x"), { label: "evil" }));
await assertFails(deleteDoc(g(anon, "courts/court-1")));
```

- [ ] **Step 5: Correct the spec**

In `docs/superpowers/specs/2026-10-07-event-game-design.md`, replace the paragraph that starts `No new collections and **no rules changes**:` with:

```
No new collections and **no rules changes**. Firestore rules do not cascade into subcollections, so `players`, `courts`, `matchLog` and `costs` under an event are owner-only (the `accounts/{uid}/{document=**}` rule); only the event document and `requests` have public rules. That is deliberately kept for 3a: nothing public needs the game data until the Live Board in step 4, which will open read access. The rules test pins it (the owner can write all four; a stranger can neither read nor write them).
```

and replace the Risks bullet that starts `**Player names become publicly readable**` with:

```
- **Player names stay private in 3a** (see Data). Step 4 decides what the Live Board may read and opens exactly that.
```

- [ ] **Step 6: Run everything**

Run: `npm run test:rules`
Expected: `rules: all assertions passed`, `cascade: ok`.

- [ ] **Step 7: Commit**

```bash
git add src/utils/accountData.js tests/cascade.test.mjs tests/rules.test.mjs docs/superpowers/specs/2026-10-07-event-game-design.md
git commit -m "feat: delete cascade covers game data; rules tests pin it owner-only" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Start a game from an event

**Files:**
- Create: `src/hooks/useEventPlayers.js`, `src/hooks/useGameActions.js`, `src/components/GamePickModal.jsx`
- Modify: `src/views/EventPage.jsx`, `src/views/Host.jsx`, `src/AccountApp.jsx`, `src/styles.css`

**Interfaces:**
- Consumes: Task 2 (`gameStartFields`, `courtDocs`, `playersToAdd`, `bookingCostEntry`, `playNowEvent`, `gamePickList`, `gameSummary`, `isOver`), Task 3 (`/event/:id/game` URLs), Task 4 (cascade).
- Produces: `useEventPlayers(uid, eventId): Player[]`; `useGameActions({ uid, account, hostName, timeZone, notify })` returning `{ startGame(event, pickedIds, players), playNow(): Promise<eventId>, endGame(eventId), reopenGame(eventId) }`; `<GamePickModal event players close submit(pickedIds) />`; `<EventPage ... gamePlayers onPickPlayers onOpenGame onReopen />`; `<Host ... onPlayNow />`.

No new unit test: this is Firestore wiring and UI over logic already pinned in Task 2. The browser steps below exercise it. (Navigating to `/event/<id>/game` shows the hub until Task 6 mounts the game page; use the header "Open play" link to come back.)

- [ ] **Step 1: Hooks**

Create `src/hooks/useEventPlayers.js`:

```js
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// The players in one event's game: the pick list greys out who is already in, and the
// event page shows a summary. Pass a null eventId to listen to nothing.
export function useEventPlayers(uid, eventId) {
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    setPlayers([]);
    if (!firebaseConfigured || !uid || !eventId) return;
    return onSnapshot(
      collection(db, "accounts", uid, "events", eventId, "players"),
      (s) => setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
  }, [uid, eventId]);
  return players;
}
```

Create `src/hooks/useGameActions.js`:

```js
import { collection, deleteField, doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { eventBase } from "../utils/paths";
import { nowIn } from "../utils/bookings";
import {
  bookingCostEntry, courtDocs, gameStartFields, playersToAdd, playNowEvent,
} from "../utils/gameSession";

// Every write that starts, extends, ends or reopens a game. The signed-in host owns all of it.
export function useGameActions({ uid, account, hostName, timeZone, notify }) {
  const acct = account || {};
  const eventRef = (id) => doc(db, ...eventBase(uid, id));
  const at = (id, ...rest) => doc(db, ...eventBase(uid, id), ...rest);

  // First start: the event goes live, courts are created, the ticked players are added (not
  // checked in) and the booking fee gets one cost entry. On a live event ("Add to game") only
  // the players are added and the cost entry refreshed. Safe to repeat: players are matched by id.
  const startGame = async (event, pickedIds, players) => {
    const now = Date.now();
    const batch = writeBatch(db);
    if (event.status !== "live") {
      const fields = gameStartFields(acct, now);
      batch.update(eventRef(event.id), fields);
      courtDocs(fields.courts, now).forEach((c) => batch.set(at(event.id, "courts", c.id), c.data));
    }
    const added = playersToAdd(event, pickedIds, players, now);
    added.forEach((p) => batch.set(at(event.id, "players", p.id), p));
    const costRef = at(event.id, "costs", `booking-${event.id}`);
    const existing = (await getDoc(costRef)).data() || null;
    const inGame = new Set([...players.map((p) => p.id), ...added.map((p) => p.id)]);
    const entry = bookingCostEntry(event, inGame, existing, now);
    if (entry) batch.set(costRef, entry);
    await batch.commit();
    notify(added.length ? `${added.length} added to the game.` : "Game started.");
  };

  // An unscheduled event for today, live straight away. Resolves to the new event id.
  const playNow = async () => {
    const now = Date.now();
    const { date, hm } = nowIn(timeZone);
    const ref = doc(collection(db, "accounts", uid, "events"));
    const event = playNowEvent({ account: acct, today: date, hm, timeZone, hostName, now });
    const batch = writeBatch(db);
    batch.set(ref, event);
    courtDocs(event.courts, now).forEach((c) => batch.set(doc(ref, "courts", c.id), c.data));
    await batch.commit();
    return ref.id;
  };

  // Ending changes the status only. Players, matches and costs stay for the event page.
  const endGame = (eventId) => updateDoc(eventRef(eventId), { status: "ended", endedAt: Date.now() });

  const reopenGame = async (eventId) => {
    await updateDoc(eventRef(eventId), { status: "live", endedAt: deleteField() });
    notify("Game reopened.");
  };

  return { startGame, playNow, endGame, reopenGame };
}
```

- [ ] **Step 2: The pick list**

Create `src/components/GamePickModal.jsx`:

```jsx
import { useState } from "react";
import Modal from "./Modal";
import { gamePickList } from "../utils/gameSession";

const PAID_TAG = { paid: "Paid", unpaid: "Unpaid", refunded: "Refunded" };

// "Proceed to game" (first start) and "Add players" (live) share this list. Nothing is
// ticked when it opens; the host ticks who is here. Ticked players join not checked in.
export default function GamePickModal({ event, players, close, submit }) {
  const rows = gamePickList(event, players);
  const live = event.status === "live";
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectable = rows.filter((r) => !r.inGame);
  const joined = rows.filter((r) => r.group === "joined");
  const waiting = rows.filter((r) => r.group === "waitlist");

  const toggle = (id) => setPicked((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const choose = (test) => setPicked(new Set(selectable.filter(test).map((r) => r.id)));
  // A first start with nobody booked is allowed: walk-ins are added in the game.
  const canSubmit = !busy && (picked.size > 0 || (!live && !rows.length));

  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await submit([...picked]);
    } catch {
      setError("Couldn't start the game. Check your connection and try again.");
      setBusy(false);
    }
  };

  const row = (r) => (
    <label className={`pick-row ${r.inGame ? "in" : ""}`} key={r.id}>
      <input type="checkbox" checked={r.inGame || picked.has(r.id)} disabled={r.inGame} onChange={() => toggle(r.id)} />
      <b>{r.name}</b>
      <span className="pick-tags">
        {r.inGame ? <span className="pill">In the game</span> : (
          <>
            {r.group === "waitlist" && <span className="pill off">Waitlist #{r.waitNo}</span>}
            <span className={`pill ${r.paid === "paid" ? "" : "off"}`}>{PAID_TAG[r.paid]}</span>
          </>
        )}
      </span>
    </label>
  );

  return (
    <Modal title={live ? "Add players to the game" : "Proceed to game"} label={event.title} close={close}>
      <p className="pick-help">
        Tick the players who are here. They join the game not checked in; tap each in on the Queue tab as they arrive.
      </p>
      <div className="pick-tools">
        <button type="button" className="tiny outline" onClick={() => choose((r) => r.group === "joined")}>Select all joined</button>
        <button type="button" className="tiny outline" onClick={() => choose((r) => r.paid === "paid")}>Select all paid</button>
        <button type="button" className="tiny outline" onClick={() => setPicked(new Set())}>Clear</button>
      </div>
      {rows.length ? (
        <div className="pick-list" role="group" aria-label="Players">
          {joined.map(row)}
          {waiting.length > 0 && <div className="pick-head">Waitlist</div>}
          {waiting.map(row)}
        </div>
      ) : (
        <div className="empty">Nobody has booked yet. Start the game and add walk-ins there.</div>
      )}
      {error && <p className="op-error" role="alert">{error}</p>}
      <div className="modalactions">
        <button className="outline" onClick={close}>Cancel</button>
        <button className="primary" disabled={!canSubmit} onClick={go}>
          {live ? "Add to game" : "Start game"}{picked.size ? ` (${picked.size})` : ""}
        </button>
      </div>
    </Modal>
  );
}
```

Append to `src/styles.css`:

```css
.pick-help{margin:0 0 10px;color:var(--muted);font-size:13px}
.pick-tools{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.pick-list{display:flex;flex-direction:column;max-height:46vh;overflow:auto;border:1px solid var(--line);border-radius:12px}
.pick-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer}
.pick-row:last-child{border-bottom:0}
.pick-row:hover{background:var(--hover)}
.pick-row.in{opacity:.55;cursor:default}
.pick-row input{width:18px;height:18px;accent-color:var(--accent);flex-shrink:0}
.pick-row b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:14px}
.pick-tags{display:flex;gap:6px;flex-shrink:0}
.pick-head{padding:8px 12px;border-bottom:1px solid var(--line);font:700 12px "Space Grotesk";color:var(--muted)}
```

- [ ] **Step 3: Event page**

In `src/views/EventPage.jsx`:

1. Change the utils imports to
   `import { bookingTotals, endHM, splitAttendees } from "../utils/bookings";` (unchanged),
   `import { formatDay, formatHM, formatTime, money } from "../utils/format";` and add
   `import { gameSummary } from "../utils/gameSession";`.
2. Change the component signature to
   `export default function EventPage({ event, requests, actions, ready, gamePlayers, onEdit, onShare, onPickPlayers, onOpenGame, onReopen, navigate }) {`.
3. Directly after `const full = confirmed.length >= event.maxPlayers;` add:

```jsx
  const summary = gameSummary(gamePlayers);
  const gameLine = event.status === "live" ? (
    <p className="booking-money"><b>Game in progress</b> · {summary.checkedIn} checked in of {summary.players}</p>
  ) : event.status === "ended" ? (
    <p className="booking-money">
      <b>Game ended</b> · {summary.players} players, {summary.matches} matches{event.endedAt ? ` · ${formatTime(event.endedAt)}` : ""}
    </p>
  ) : null;
```

4. Directly above the `{event.fee > 0 && (` money paragraph inside the first `<div className="panel">`, add `{gameLine}`.
5. Replace the disabled placeholder button

```jsx
          <button className="pill toggle" disabled title="Coming in the next update"><Play size={12} /> Proceed to game (coming soon)</button>
```

with

```jsx
          {event.status === "ended" ? (
            <button className="pill toggle" onClick={onReopen}><Play size={12} /> Reopen game</button>
          ) : event.status === "live" ? (
            <>
              <button className="pill toggle" onClick={onOpenGame}><Play size={12} /> Back to game</button>
              {!event.walkIn && <button className="pill toggle off" onClick={onPickPlayers}>Add players to game</button>}
            </>
          ) : (
            <button className="pill toggle" onClick={onPickPlayers}><Play size={12} /> Proceed to game</button>
          )}
```

- [ ] **Step 4: Host list**

In `src/views/Host.jsx`:

1. Change the bookings import to `import { bookingTotals, byStart, endHM, isOver, splitAttendees } from "../utils/bookings";` and the lucide import to `import { CalendarPlus, ChevronRight, Play, Share2 } from "lucide-react";`.
2. Replace the two filter lines in `Host` with:

```jsx
  const upcoming = events.filter((e) => !isOver(e, fallbackZone)).sort(byStart);
  const past = events.filter((e) => isOver(e, fallbackZone)).sort((a, b) => byStart(b, a));
```

3. Change the signature to `export default function Host({ events, requestsByEvent, fallbackZone, onNew, onPlayNow, onShare, navigate }) {` and add, as the first button inside `<div className="booking-toolbar">`:

```jsx
          <button className="outline" onClick={onPlayNow}><Play size={15} /> Play now</button>
```

4. In `EventRow`, replace the `history-entry-badges` block with:

```jsx
      <div className="history-entry-badges">
        {pending > 0 && <span className="badge-open">{pending} new</span>}
        {e.status === "live" && <span className="badge-open">Live</span>}
        {e.walkIn ? (
          <span className="pill off">Walk-in</span>
        ) : (
          <>
            <span className={`pill ${confirmed.length >= e.maxPlayers ? "" : "off"}`}>{confirmed.length}/{e.maxPlayers} joined</span>
            {e.fee > 0 && (
              <span className={`pill settle-badge ${totals.seats && totals.paidCount === totals.seats ? "" : "off"}`}>
                {totals.paidCount}/{totals.seats} paid
              </span>
            )}
          </>
        )}
      </div>
```

and in the row's `<small>` line, show `Free` only when not a walk-in fee: leave the existing line unchanged (a walk-in reads "Free").

- [ ] **Step 5: Wire the shell**

In `src/AccountApp.jsx`:

1. Imports: change `import { hasEndedIn } from "./utils/bookings";` to `import { isOver } from "./utils/bookings";`; add
   `import { useEventPlayers } from "./hooks/useEventPlayers";`,
   `import { useGameActions } from "./hooks/useGameActions";`,
   `import GamePickModal from "./components/GamePickModal";`.
2. Next to the other `useState` lines add `const [gamePick, setGamePick] = useState(false);`.
3. Change the `watched` line to use `isOver`:
   `const watched = events.filter((e) => !isOver(e, fallbackZone) || e.id === eventId).map((e) => e.id);`
4. After the `requestsByEvent` line add `const gamePlayers = useEventPlayers(uid, route === "event" ? eventId : null);`.
5. After the `actions` definition (`useEventActions`) add:

```jsx
  const gameActions = useGameActions({
    uid, account: acct.account, hostName: acct.account?.clubName || "", timeZone: display.timeZone, notify,
  });
  const openEvent = events.find((e) => e.id === eventId);
  const playNow = async () => {
    try {
      navigate(`/event/${await gameActions.playNow()}/game`);
    } catch {
      notify("Couldn't start a game. Check your connection and try again.", 4000);
    }
  };
```

6. On `<Host ...>` add `onPlayNow={playNow}`. On `<EventPage ...>` add
   `gamePlayers={gamePlayers} onPickPlayers={() => setGamePick(true)} onOpenGame={() => navigate(`/event/${eventId}/game`)} onReopen={() => gameActions.reopenGame(eventId)}`.
7. Above `<Toast ...>` add:

```jsx
      {gamePick && openEvent && (
        <GamePickModal
          event={openEvent} players={gamePlayers} close={() => setGamePick(false)}
          submit={async (ids) => {
            await gameActions.startGame(openEvent, ids, gamePlayers);
            setGamePick(false);
            navigate(`/event/${openEvent.id}/game`);
          }}
        />
      )}
```

- [ ] **Step 6: Verify**

Run: `npx vite build`
Expected: success. Then `git checkout -- dist && git clean -fdq dist`.

Browser check (dev server `npx vite --port 5200`, sign in with a throwaway account):
1. `/host` shows "Play now" next to "New open play". Create "ZZ Game" (fee 150, 3 spots). On its page add Ana, Ben, Cy, Dee by name (Dee lands on the waitlist). Mark Ana Paid.
2. "Proceed to game": the list shows Ana (Paid), Ben (Unpaid), Cy (Unpaid), then a "Waitlist" heading with Dee (Waitlist #1, Unpaid). Nothing is ticked and "Start game" is disabled. "Select all paid" ticks Ana only. "Select all joined" ticks Ana, Ben, Cy. Untick Cy, tick Dee: "Start game (3)".
3. Start: the URL becomes `/event/<id>/game` (the hub shows until Task 6). Go back through "Open play" → the event. The page shows "Game in progress · 0 checked in of 3", and "Back to game" and "Add players to game" buttons. `/host` shows a "Live" badge on the row.
4. "Add players to game": Ana, Ben and Dee are greyed "In the game"; Cy is selectable. Tick Cy → "Add to game (1)". The summary reads "0 checked in of 4".
5. Back on `/host`, "Play now" creates a "Play now" event and navigates to its game URL. Its row shows "Live" and "Walk-in".

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useEventPlayers.js src/hooks/useGameActions.js src/components/GamePickModal.jsx src/views/EventPage.jsx src/views/Host.jsx src/AccountApp.jsx src/styles.css
git commit -m "feat: proceed to game with a pick list, add players, Play now" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The game page

**Files:**
- Create: `src/Game.jsx`
- Modify: `src/QueueApp.jsx`, `src/components/Sidebar.jsx`, `src/components/Topbar.jsx`, `src/AccountApp.jsx`

**Interfaces:**
- Consumes: `eventBase` (Task 1), `buildGameSession` (Task 2), `useGameActions.endGame` (Task 5).
- Produces: `<QueueApp base kind deriveSession eyebrow backLabel onBack onEndSession onErase />` with `kind` `"quick"` (default) or `"event"`; `<Sidebar ... endLabel hiddenTabs backLink />`; `<Topbar ... eyebrow showShare />`; `<Game uid account event ready navigate endGame />`.

- [ ] **Step 1: Sidebar and Topbar**

In `src/components/Sidebar.jsx`:

1. Add `ArrowLeft` to the lucide import.
2. Change the signature's destructure to
   `session, courtCount, mode, onChangeMode, tab, onSelectTab, onEndSession, endLabel = "End Session", hiddenTabs = [], backLink = null, open, onClose, collapsed, onToggleCollapse,`
   (keep it as the existing multi-line destructure, adding the three new names).
3. Change `{NAV_ITEMS.map((item) => (` to `{NAV_ITEMS.filter((item) => !hiddenTabs.includes(item.key)).map((item) => (`.
4. Replace the End Session button with:

```jsx
            {backLink && (
              <button className="sidebar-endsession" onClick={backLink.onClick} title={backLink.label}>
                <ArrowLeft /> <span>{backLink.label}</span>
              </button>
            )}
            <button className="sidebar-endsession" onClick={onEndSession} title={endLabel}>
              <Flag /> <span>{endLabel}</span>
            </button>
```

Replace `src/components/Topbar.jsx` with:

```jsx
import { Menu, Plus, Share2 } from "lucide-react";
import { TITLES } from "../data/constants";
import PhClock from "./PhClock";

export default function Topbar({ tab, onOpenMenu, onShare, onAddPlayer, eyebrow = "OPEN PLAY SESSION", showShare = true }) {
  const [title, subtitle] = TITLES[tab];
  return (
    <header className="topbar">
      <button className="icon hamburger" onClick={onOpenMenu} aria-label="Open menu"><Menu /></button>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="actions">
        <button className="primary" onClick={onAddPlayer}><Plus /> Add Player</button>
        <PhClock />
        {showShare && (
          <button className="outline" onClick={onShare}><Share2 /> Share<span className="share-btn-full"> Live Board</span></button>
        )}
      </div>
      <button className="fab-add" onClick={onAddPlayer} aria-label="Add player"><Plus /></button>
    </header>
  );
}
```

- [ ] **Step 2: QueueApp event mode**

In `src/QueueApp.jsx` (Edit tool, old text exactly as shown):

1. Signature: replace `export default function QueueApp({ base, onEndSession, onErase }) {` with

```jsx
export default function QueueApp({
  base, kind = "quick", deriveSession, eyebrow, backLabel, onBack, onEndSession, onErase,
}) {
```

and extend the comment above it with: `// kind "event" is a game on an event: the session is derived from the event doc plus the account settings, there is no Settings tab, and End game keeps all data.`

2. Replace `const { session, players, courts, busy } = useSessionData(base);` with

```jsx
  const { session: rawSession, players, courts, busy } = useSessionData(base);
  const session = deriveSession ? deriveSession(rawSession) : rawSession;
  const noun = kind === "event" ? "game" : "session";
```

3. `Sidebar` element: add the props
   `endLabel={kind === "event" ? "End game" : "End Session"}`, `hiddenTabs={kind === "event" ? ["settings"] : []}`, `backLink={kind === "event" ? { label: backLabel, onClick: onBack } : null}`.
4. `Topbar` element: add `eyebrow={eyebrow}` and `showShare={kind === "quick"}`. (When `eyebrow` is undefined the Topbar default applies.)
5. `<Stats ... sessionId={base[1]} />` becomes `sessionId={kind === "quick" ? base[1] : null}`.
6. `{tab === "settings" && (` becomes `{tab === "settings" && kind === "quick" && (`.
7. `{showShare && (` becomes `{showShare && kind === "quick" && (`.
8. Replace the End Session `ConfirmDialog` with:

```jsx
        {showEndSession && (
          <ConfirmDialog
            title={kind === "event" ? "End game?" : "End Session?"}
            message={kind === "event"
              ? "This closes the game. Players, matches and costs stay saved on the event, and you can reopen it from the event page."
              : "This closes out today's play: stats are archived to Stats → Past Sessions, the match log and courts are cleared, and everyone will need to check in again next time."}
            confirmLabel={kind === "event" ? "End game" : "End Session"}
            onCancel={() => setShowEndSession(false)}
            onConfirm={() => {
              setShowEndSession(false);
              Promise.resolve(onEndSession())
                .then(() => {
                  if (kind === "quick") { setTab("dashboard"); notify("Session ended. Stats are saved to Past Sessions."); }
                })
                .catch(() => notify(`Couldn't end the ${noun} — please try again.`, 4000));
            }}
          />
        )}
```

- [ ] **Step 3: The game page**

Create `src/Game.jsx`:

```jsx
import { ArrowLeft } from "lucide-react";
import QueueApp from "./QueueApp";
import { eventBase } from "./utils/paths";
import { buildGameSession } from "./utils/gameSession";
import { formatDay } from "./utils/format";

// A message with a way back, for a game link that can't open a game right now.
function Message({ text, to, label, navigate }) {
  return (
    <div className="acct-shell">
      <main className="acct-main">
        <div className="panel">
          <div className="empty">{text}</div>
          <a className="outline back-link" href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>
            <ArrowLeft size={14} /> {label}
          </a>
        </div>
      </main>
    </div>
  );
}

// /event/:id/game: the queue app on one event. The event doc is the session; the account's
// settings (rules, cost defaults, display) are merged over it by buildGameSession.
export default function Game({ uid, account, event, ready, navigate, endGame }) {
  if (!event) {
    return ready ? (
      <Message text="This open play doesn't exist or was deleted." to="/host" label="Back to open play" navigate={navigate} />
    ) : <div className="loading"><span className="spinner" />Loading…</div>;
  }
  const eventPage = `/event/${event.id}`;
  if (event.status === "ended") {
    return <Message text="This game has ended. Reopen it from the event page to keep playing." to={eventPage} label="Back to event" navigate={navigate} />;
  }
  if (event.status !== "live") {
    return <Message text="This game hasn't started. Start it from the event page." to={eventPage} label="Back to event" navigate={navigate} />;
  }
  return (
    <QueueApp
      key={event.id}
      kind="event"
      base={eventBase(uid, event.id)}
      deriveSession={(raw) => buildGameSession(account, raw)}
      eyebrow={`${event.title} · ${formatDay(event.date)}`}
      backLabel="Back to event"
      onBack={() => navigate(eventPage)}
      onEndSession={async () => { await endGame(event.id); navigate(eventPage); }}
    />
  );
}
```

- [ ] **Step 4: Mount it**

In `src/AccountApp.jsx`:

1. Change `import { useRef, useState } from "react";` to `import { Suspense, lazy, useRef, useState } from "react";` and add, after the imports, `const Game = lazy(() => import("./Game"));` (the queue app loads only when a game opens).
2. After the `if (acct.status === "out") { ... }` block and before `const go = ...`, add:

```jsx
  if (route === "game") {
    return (
      <Suspense fallback={<div className="loading"><span className="spinner" />Loading…</div>}>
        <Game
          uid={uid} account={acct.account} event={events.find((e) => e.id === eventId)} ready={eventsReady}
          navigate={navigate} endGame={gameActions.endGame}
        />
      </Suspense>
    );
  }
```

3. In the header nav, change the "Open play" link's active test to `route === "host" || route === "event"` (unchanged: the game page has no account header).

- [ ] **Step 5: Verify**

Run: `npx vite build`
Expected: success, and the build output lists a separate `Game` chunk. Then `git checkout -- dist && git clean -fdq dist`.

Browser check (dev server, signed in, using the event from Task 5 or a new one with 4 bookings):
1. Open the live event's page, "Back to game": `/event/<id>/game` shows the queue app. The sidebar names the event, the tabs are Dashboard, Queue, Players, Cost, Stats, Guide (no Settings), the top bar eyebrow reads `<title> · <date>`, and there is no "Share Live Board" button. Sidebar buttons: "Back to event" and "End game".
2. Queue tab: the players you ticked are under "not checked in". Tap four in; Dashboard → fill open seats; record a win; Undo it; record again.
3. Players tab: "Add Player" a walk-in (checked in). Cost tab: the booking entry exists with Ana marked paid; toggling a player's paid flag works.
4. Stats shows this game's players; there is no "Past Sessions" list.
5. Dashboard: add a court, change the mode in the sidebar; reload the page: both persist.
6. "End game" → confirm → you land on the event page: "Game ended · 5 players, N matches · <time>" and a "Reopen game" button. Open `/event/<id>/game` directly: "This game has ended…" with "Back to event". "Reopen game": toast "Game reopened.", and "Back to game" returns to the same players and stats.
7. On a scheduled event, open `/event/<id>/game` directly: "This game hasn't started…". On `/event/nope/game`: "This open play doesn't exist or was deleted." with a working link back.
8. Play now: opens the game with 2 courts (or the account's default), no players; Add Player works; End game returns to its event page.
9. Reload `/club`: the quick session still has its Settings tab, Share Live Board, and End Session (spot check only).

- [ ] **Step 6: Commit**

```bash
git add src/Game.jsx src/QueueApp.jsx src/components/Sidebar.jsx src/components/Topbar.jsx src/AccountApp.jsx
git commit -m "feat: the game page runs the queue on an event" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Public listing, delete message, docs, the full check

**Files:**
- Modify: `src/OpenPlay.jsx`, `src/views/EventPage.jsx`, `CLAUDE.md`

- [ ] **Step 1: Keep walk-ins and ended events off the public page (Review Focus 3)**

In `src/OpenPlay.jsx` change the import `import { byStart, endHM, hasEndedIn, myStatus, splitAttendees } from "./utils/bookings";` to `import { byStart, endHM, isListed, myStatus, splitAttendees } from "./utils/bookings";` and replace the `upcoming` memo's filter with:

```jsx
    () => events.filter((e) => isListed(e, DEFAULT_DISPLAY.timeZone)).sort(byStart),
```

In `src/views/EventPage.jsx`, change the delete dialog message to:

```jsx
          message={`${event.title}, its player list, payment records, join requests and any game (players, matches and costs) will be removed. Players with a pending request will see it's no longer listed.`}
```

- [ ] **Step 2: Document it**

In `CLAUDE.md`:

1. Replace the bullet that begins `- "Play now" and "Proceed to game" are step 3;` with:

```md
- Game on an event (step 3a, spec `docs/superpowers/specs/2026-10-07-event-game-design.md`): `QueueApp.jsx` is the queue app on a `base`
  path (`utils/paths.js`: `sessionBase(uid)` for the quick session, `eventBase(uid, id)` for a game); every write goes through its `at` /
  `col` helpers. `Club.jsx` wraps it at `/club`; `Game.jsx` at `/event/:id/game` (gates on event `status`, merges the account settings with
  `buildGameSession`). "Proceed to game" (`GamePickModal`, nothing pre-ticked) adds the ticked attendees as players NOT checked in, sets the
  event `live`, creates courts from the account's Session defaults and one booking-fee Cost entry (`booking-{eventId}`); "Add players to game"
  repeats it safely (players are matched by attendee id). "Play now" makes a `walkIn` event (4 h, no seats, hidden from the public page).
  "End game" sets `status: "ended"` and keeps everything; "Reopen game" sets it `live`. Pure logic and its check: `utils/gameSession.js`,
  `node src/utils/gameSession.check.mjs`; writes in `hooks/useGameActions.js`. Game data (`players`, `courts`, `matchLog`, `costs` under an
  event) is owner-only (rules don't cascade into subcollections); step 4 opens read for the Live Board. Delete cascade covers all of it
  (`EVENT_SUBCOLLECTIONS`).
- Still to build: the roster and skill memory (step 3b), per-event Live Board links and the landing page (step 4).
```

2. At the end of the `Quick session at /club` bullet, add the sentence: `The page is Club.jsx (useClub) around QueueApp.`

- [ ] **Step 3: Run everything**

```bash
node src/utils/account.check.mjs && node src/utils/route.check.mjs && node src/utils/bookings.check.mjs && node src/utils/paths.check.mjs && node src/utils/gameSession.check.mjs && node src/utils/theme.check.mjs && node src/utils/rotationModes.check.mjs && npm run test:rules && npx vite build
```

Expected: six `ok` / `passed` lines, `rules: all assertions passed`, `cascade: ok`, and a successful build. Then `git checkout -- dist && git clean -fdq dist`.

- [ ] **Step 4: Full browser pass (Review Focus 1, 4, 5)**

Dev server running, signed in with a throwaway account:
1. **Deep link signed out:** copy a live game's URL, sign out, paste it: the sign-in form. Sign in: you land on that game (or the "not started"/"ended" message), not the hub.
2. **Quick session:** repeat Task 1's browser regression list on `/club` (add, check in, fill, win, undo, cost, End Session archives, erase).
3. **A full game:** create an event (fee 150, 3 spots, 4 bookings incl. one waitlist), Proceed with a mixed pick, check in, play two matches, End game, Reopen, End game. The event page summary matches.
4. **Cascade with game data:** on that event, Delete: the confirmation mentions the game; confirm; `/host` no longer lists it.
5. **Delete account:** create one more event with a started game, then Settings → Delete account. Sign back in with the same email: it is a brand-new account (or sign-up works again), proving the data and the login are gone.
6. **Public page (needs the step 2 rules published; skip if they are not yet):** with a scheduled event and a Play now event present, `/open-play?host=<uid>` in a signed-out window lists the scheduled event but not "Play now"; after End game the scheduled event disappears from the list.

- [ ] **Step 5: Commit**

```bash
git add src/OpenPlay.jsx src/views/EventPage.jsx CLAUDE.md
git commit -m "docs: describe the game on an event; keep walk-ins off the public page" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage:**
- Same queue app on a path (`paths.js`, hooks, `QueueApp`, `Club`, `Game`): Tasks 1, 6.
- No rules changes (with the corrected, private subcollections): Task 4 (tests + spec fix).
- Event doc fields (`status`, `courts`, `format`, `mode`, `autoRotate`, `startedAt`, `endedAt`, `walkIn`): Tasks 2 (`gameStartFields`, `playNowEvent`), 5 (`startGame`, `endGame`, `reopenGame`).
- `buildGameSession`, players with attendee ids, idempotent start: Tasks 2, 5.
- Proceed to game pick list (nothing ticked, shortcuts, tags, in-the-game state, not checked in, cost entry with deterministic id): Tasks 2, 5.
- Play now (button on `/host`, walk-in tag, no pick list): Tasks 2, 5.
- In-game differences (title eyebrow, no Settings tab, hidden Share, End game keeps data, Back to event, Stats without history): Task 6.
- Event page game line, Reopen: Task 5.
- Routes (`game`, `eventIdOf`, unknown id message): Tasks 3, 6.
- Delete cascade covers game subcollections: Task 4; delete confirmation text: Task 7.
- Tests: `paths`, `gameSession`, `route`, `bookings` checks; emulator rules + cascade; browser passes: Tasks 1–7.
- Spec Risks: quick-session regression (Task 1, 7 browser passes); reopen mixes stats (accepted, no work).
- Deliberate deviation from the spec text: public read of game subcollections (stated in "Before you start" and Task 4).

**Placeholders:** none. Every code step has full code; edits to existing large files give exact old and new text; browser checks list actions and outcomes.

**Type consistency:** `base` is an array everywhere (`sessionBase`/`eventBase` → hooks → `QueueApp`); `buildGameSession(account, event)`, `gameStartFields(account, now)`, `courtDocs(count, now)`, `gamePickList(event, players)`, `playersToAdd(event, pickedIds, players, now)`, `bookingCostEntry(event, inGameIds: Set, existing, now)`, `playNowEvent({ account, today, hm, timeZone, hostName, now })`, `gameSummary(players)` are defined in Task 2 and called with the same shapes in Tasks 5 and 6. `useGameActions` returns `{ startGame, playNow, endGame, reopenGame }`, used by `AccountApp` (Tasks 5, 6) and `Game` (`endGame` prop). `EventPage` props (`gamePlayers`, `onPickPlayers`, `onOpenGame`, `onReopen`) match the `AccountApp` call. `QueueApp` props (`kind`, `deriveSession`, `eyebrow`, `backLabel`, `onBack`, `onEndSession`, `onErase`) match both wrappers. `isOver` / `isListed` (Task 2) are used by `Host`, `AccountApp` (Task 5) and `OpenPlay` (Task 7).

**Review Focus coverage:** 1 by `paths.check.mjs` plus the `/club` browser passes (Tasks 1, 7); 2 by `gameSession.check.mjs` (Task 2); 3 by `isListed` / `isOver` checks (Task 2) and Task 7 step 1; 4 by `tests/cascade.test.mjs` (Task 4); 5 by `route.check.mjs` (Task 3) and the browser steps in Tasks 6 and 7.
