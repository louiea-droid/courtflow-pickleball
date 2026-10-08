# Active Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Home shows a "Your active session" card while the person is checked in to a live game at one of their clubs, with a read-only queue page behind "View queue".

**Architecture:** Players get an optional `uid` (from signed-in bookings, or picked by the host for walk-ins). Club members may read a game's `players` and `courts`. The hub listens to each of the person's clubs for live events and, for each, to its players and courts; a pure function turns those into position / ahead / wait.

**Tech Stack:** React 19, Firebase Firestore, node `*.check.mjs` checks, rules tests (`npm run test:rules`, emulator).

**Spec:** `docs/superpowers/specs/2026-10-09-active-queue-design.md`

## Global Constraints

- Colors via tokens only; new CSS in `src/clubs.css` (never `styles.css`); sentence case, no avatar badges next to names.
- A real account only (`isAccountUser` in `utils/account.js`; rules `isRealUser()`), never a quick-session or old club login.
- `uid` never goes on the public attendee list; it lives on the private request and on the player doc.
- Game data other than `players` and `courts` (`matchLog`, `costs`, `requests`) stays closed to plain members.
- The working tree has other people's uncommitted edits (theme work, `dist/`): commit only your own hunks (see memory `clubs-part-c`); never `git add -A`.

## Review Focus

1. A signed-in non-member sending a request for a public club's event: `uid` must equal their own and never be someone else's.
2. A quick-session (anonymous) visitor booking: no `uid` is sent and the booking still works.
3. A member who is not a manager reading `players`/`courts` yet failing on `matchLog`, `costs`, `requests` and writes.
4. A person in two clubs' live games, or in the queue of an ended game (ended games never show).
5. Ties in the queue (same games and check-in time) and an empty `courts` collection.

---

### Task 1: `queueStatus` (pure rules)

**Files:**
- Create: `src/utils/queueStatus.js`, `src/utils/queueStatus.check.mjs`

**Interfaces:**
- Produces: `queueStatus({ players, courts, uid, format, gameMinutes })` → `null | { state: "playing", court } | { state: "waiting", position, ahead, waitMins, upNext }`; `queueOrder(players, courts)` → players checked in and not on a court, fewest games then earliest `checkedAt` then `id`; `DEFAULT_GAME_MINUTES = 15`.

- [ ] **Step 1: Write the failing check** (`node src/utils/queueStatus.check.mjs`)

```js
import assert from "node:assert/strict";
import { DEFAULT_GAME_MINUTES, queueOrder, queueStatus } from "./queueStatus.js";

const P = (id, o = {}) => ({ id, uid: o.uid, checked: true, games: 0, checkedAt: 1, ...o });
const court = (n, a = [], b = []) => ({ id: `court-${n}`, courtNumber: n, teamA: a, teamB: b });

// order: fewest games first, then earliest check-in, then id; not-checked-in and on-court players are out
const players = [P("a", { games: 2 }), P("b", { games: 0, checkedAt: 5 }), P("c", { games: 0, checkedAt: 3 }), P("d", { checked: false }), P("e")];
const courts = [court(1, ["e"], [])];
assert.deepEqual(queueOrder(players, courts).map((p) => p.id), ["c", "b", "a"]);

// not in the game, not checked in, nobody
assert.equal(queueStatus({ players, courts, uid: "x", format: "Doubles" }), null);
assert.equal(queueStatus({ players: [P("d", { uid: "u", checked: false })], courts, uid: "u", format: "Doubles" }), null);
assert.equal(queueStatus({ players: [], courts: [], uid: "u", format: "Doubles" }), null);

// on a court
assert.deepEqual(queueStatus({ players: [P("e", { uid: "u" })], courts: [court(2, ["e"])], uid: "u", format: "Doubles" }), { state: "playing", court: 2 });

// waiting: both courts busy, 2 courts x 4 seats = 8 per round; position 4 -> round 1 -> (1 - 0.5) x 15 = 7.5 -> 10
const busy = [court(1, ["p1", "p2"], ["p3", "p4"]), court(2, ["p5", "p6"], ["p7", "p8"])];
const q = ["w1", "w2", "w3"].map((id, i) => P(id, { checkedAt: i }));
const me = P("me", { uid: "u", checkedAt: 9 });
assert.deepEqual(queueStatus({ players: [...q, me], courts: busy, uid: "u", format: "Doubles", gameMinutes: 15 }),
  { state: "waiting", position: 4, ahead: 3, waitMins: 10, upNext: false });
// position 9 on 8 seats per round -> round 2 -> 1.5 x 15 = 22.5 -> 25 (rounded to 5)
const many = Array.from({ length: 8 }, (_, i) => P(`m${i}`, { checkedAt: i }));
assert.equal(queueStatus({ players: [...many, me], courts: busy, uid: "u", format: "Doubles", gameMinutes: 15 }).waitMins, 25);
// singles: 2 seats per court, so position 3 with 2 courts -> round 2
const s = queueStatus({ players: [P("s1"), P("s2"), me], courts: busy, uid: "u", format: "Singles", gameMinutes: 20 });
assert.equal(s.position, 3);
assert.equal(s.waitMins, 30); // 1.5 x 20
// a free court: the first seats on it are up next, wait 0
const oneFree = [court(1, ["p1", "p2"], ["p3", "p4"]), court(2)];
assert.deepEqual(queueStatus({ players: [P("w1"), me], courts: oneFree, uid: "u", format: "Doubles" }),
  { state: "waiting", position: 2, ahead: 1, waitMins: 0, upNext: true });
// the default game length, ties broken by id, and no courts at all (nothing to wait for: up next)
assert.equal(DEFAULT_GAME_MINUTES, 15);
const tieA = P("a1", { uid: "u" }), tieB = P("b1");
assert.equal(queueStatus({ players: [tieB, tieA], courts: busy, uid: "u", format: "Doubles" }).position, 1);
assert.equal(queueStatus({ players: [me], courts: [], uid: "u", format: "Doubles" }).upNext, true);
console.log("queueStatus.check: ok");
```

- [ ] **Step 2: Run it** — `node src/utils/queueStatus.check.mjs`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```js
// Where a person stands in a live game, for the Home card. Pure: no Firestore. The order is the queue app's
// default (fewest games, then earliest check-in); Winners / Losers, Custom and Mixed Doubles pick by other
// rules, so the number is an estimate ("about").
export const DEFAULT_GAME_MINUTES = 15;

const onCourt = (c) => [...(c.teamA || []), ...(c.teamB || [])];

export function queueOrder(players, courts) {
  const playing = new Set(courts.flatMap(onCourt));
  return players
    .filter((p) => p.checked && !playing.has(p.id))
    .sort((a, b) => a.games - b.games || a.checkedAt - b.checkedAt || (a.id < b.id ? -1 : 1));
}

export function queueStatus({ players, courts, uid, format, gameMinutes = DEFAULT_GAME_MINUTES }) {
  const mine = players.find((p) => p.uid === uid && p.checked);
  if (!uid || !mine) return null;
  const court = courts.find((c) => onCourt(c).includes(mine.id));
  if (court) return { state: "playing", court: court.courtNumber };
  const perCourt = format === "Singles" ? 2 : 4;
  const position = queueOrder(players, courts).findIndex((p) => p.id === mine.id) + 1;
  const free = courts.filter((c) => onCourt(c).length === 0).length;
  if (courts.length === 0 || position <= free * perCourt) return { state: "waiting", position, ahead: position - 1, waitMins: 0, upNext: true };
  const rounds = Math.ceil((position - free * perCourt) / (courts.length * perCourt));
  const waitMins = Math.round(((rounds - 0.5) * gameMinutes) / 5) * 5;
  return { state: "waiting", position, ahead: position - 1, waitMins, upNext: false };
}
```

- [ ] **Step 4: Run again.** Expected: `queueStatus.check: ok`. (If a rounding expectation in Step 1 differs by the formula above, fix the check's number against the spec rule `(rounds − 0.5) × minutes` rounded to 5; do not change the rule.)
- [ ] **Step 5: Commit** `git add src/utils/queueStatus.js src/utils/queueStatus.check.mjs && git commit -m "feat: queueStatus, the position and wait estimate"`

---

### Task 2: Rules: optional `uid` on event requests; member read of `players` and `courts`

**Files:**
- Modify: `firestore.rules` (`validEventRequest`, the `match /{sub}/{docId}` block under events), `tests/rules.test.mjs`

- [ ] **Step 1: Write failing assertions** in `tests/rules.test.mjs` (use the file's existing `real(uid)`, `quick`, `stranger`, `mem`, `mgr`, `anon`, seeded `clubs/pub` and `clubs/priv` events; follow the neighbouring request tests for the doc shape):
  - a signed-in stranger creates a request on a public club's event with `uid` equal to their own: **succeeds**; with someone else's uid: **fails**; a quick-session (anonymous) user with a `uid`: **fails**; the same request without `uid` still works for the visitor not signed in; a non-string `uid`: **fails**.
  - `getDocs(collection(mem, "clubs/pub/events/<id>/players"))` and `.../courts`: **succeeds** for a plain member; a stranger, a signed-out visitor and a quick-session user: **fail**; a member reading `matchLog` and `costs`: **fails**; a member writing a `players` doc: **fails**; a manager still reads and writes all of them. Same on the private club.
- [ ] **Step 2: Run** `npm run test:rules`. Expected: the new assertions FAIL (uid refused by `hasOnly`; member read refused).
- [ ] **Step 3: Implement.** In `validEventRequest`: `hasOnly([... 'uid' ...])` and `&& (!('uid' in d) || (d.uid is string && isRealUser() && d.uid == request.auth.uid))`. In the event's `match /{sub}/{docId}`: `allow write: if isManager(clubId); allow read: if isManager(clubId) || (sub in ['players','courts'] && isMember(clubId));` (comment: members see the queue; skill and gender are on these documents).
- [ ] **Step 4: Run** `npm run test:rules`. Expected: all three suites pass.
- [ ] **Step 5: Commit** (rules + test).

---

### Task 3: Link players to accounts from bookings

**Files:**
- Modify: `src/OpenPlay.jsx`, `src/utils/gameSession.js`, `src/utils/gameSession.check.mjs`, `src/hooks/useGameActions.js`, `src/ClubApp.jsx`

**Interfaces:**
- Produces: `playersToAdd(event, pickedIds, players, now, uidBySeat = {})` sets `uid` on a new player when `uidBySeat[attendee.id]` exists; `startGame(shown, pickedIds, uidBySeat)`; `uidBySeat(requests)` helper in `gameSession.js` → `{ [seatId]: uid }`.

- [ ] **Step 1: Failing checks** in `gameSession.check.mjs`: `playersToAdd` with `{ a1: "u1" }` gives player `a1` `uid: "u1"` and others no `uid` key; `uidBySeat([{seatId:"s1",uid:"u1"},{seatId:"s2"},{seatId:"s3",uid:7}])` → `{ s1: "u1" }`.
- [ ] **Step 2: Run** `node src/utils/gameSession.check.mjs` → FAIL.
- [ ] **Step 3: Implement** both in `gameSession.js` (a non-string `uid` is ignored); `useGameActions.startGame` passes the map to `playersToAdd`; `ClubApp` passes `uidBySeat(requestsByEvent[openEvent.id] || [])` as the third argument where it calls `startGame`.
- [ ] **Step 4: `OpenPlay.jsx`:** read the signed-in user once (`onAuthStateChanged(auth, ...)`, `isAccountUser(user) && user.providerData.length` as the real-account test, matching `isRealUser`), and add `...(uid ? { uid } : {})` to the request document. A visitor who is not signed in, or is anonymous, sends exactly what it sends today.
- [ ] **Step 5: Run** `node src/utils/gameSession.check.mjs`, `npm run build`. Expected: ok.
- [ ] **Step 6: Commit.**

---

### Task 4: Host picks a club member for a walk-in

**Files:**
- Modify: `src/components/PlayerModal.jsx`, `src/QueueApp.jsx`, `src/Game.jsx`, `src/ClubApp.jsx`

- [ ] **Step 1:** `QueueApp` takes an optional `memberChoices` prop (`[{ id, name }]`, empty by default) and passes it to `PlayerModal`. `Game.jsx` takes `memberChoices` and passes it; `ClubApp` supplies `useMembers(clubId).members` mapped to `{ id, name }` while the game route is open (so the listener runs only for managers on the game screen).
- [ ] **Step 2:** `PlayerModal`: when `memberChoices.length`, show a "Club member (optional)" `Select` with "Not a club member" first; choosing one sets `name` to the member's name when the name field is empty and keeps `uid` in state; submit includes `uid` (or `deleteField()`-style omission: for an edit, submitting "Not a club member" removes it with `uid: deleteField()` only when the player had one). Existing edit flows are unchanged when `memberChoices` is empty (quick session).
- [ ] **Step 3:** `QueueApp.addPlayer` already spreads `data` into the player doc, so `uid` reaches the document; confirm `updatePlayerInfo` passes it through.
- [ ] **Step 4: Verify** `npm run build`; browser: add a walk-in with a member picked, check the player doc has `uid`.
- [ ] **Step 5: Commit.**

---

### Task 5: The Home card

**Files:**
- Create: `src/hooks/useActiveQueues.js`, `src/components/ActiveQueue.jsx`
- Modify: `src/views/Hub.jsx`, `src/AccountApp.jsx` (pass `uid`), `src/clubs.css`

**Interfaces:**
- Consumes: `queueStatus`, `useMyClubs` data (`clubs`).
- Produces: `<ActiveQueue uid clubs navigate />` renders `<section class="home-active">` containing one `<article class="queue-card">` per live event the person is in; the section is hidden with CSS when it has none.

- [ ] **Step 1:** `useActiveQueues(uid, clubIds)`-style components, not one hook with dynamic loops: `ActiveQueue` maps `clubs` to `<ClubLive>` (one `onSnapshot` on `query(collection(db, "clubs", id, "events"), where("status", "==", "live"))`, errors ignored, a club the person can't read yields nothing); each live event renders `<EventQueueCard>` which listens to `players` and `courts` (errors ignored) and renders only when `queueStatus` is not null.
- [ ] **Step 2:** The card: club name and event title, a green dot with "Queue is active", then either "You're #4 in line · 3 players ahead · about 10 min" (`upNext`: "You're up next"), or "You're on court 2"; a **View queue** link to `/clubs/:id/event/:eventId/queue` (`outline`, 44px). `gameMinutes` is the club's `rules.gameAlertMinutes` when above 0 (club doc is not read here; use the default 15, ponytail: read the club rules if estimates prove off).
- [ ] **Step 3:** `Hub.jsx` renders the section between the "Ready to play?" card and "My clubs", with the heading "Your active session" inside the section so it disappears with it: `.home-active:not(:has(.queue-card)){display:none}`. CSS uses tokens, an accent left border like `.home-ready`, and wraps on a phone.
- [ ] **Step 4: Verify** `npm run build`; browser (Task 7).
- [ ] **Step 5: Commit.**

---

### Task 6: The read-only queue page

**Files:**
- Create: `src/views/QueueView.jsx`
- Modify: `src/utils/route.js`, `src/utils/route.check.mjs`, `src/ClubApp.jsx`, `src/clubs.css`

- [ ] **Step 1: Failing check:** `routeOf("/clubs/abc/event/e1/queue")` → `"club-queue"`, `eventIdOf` of it → `"e1"`; `/clubs/abc/event/e1/game` unchanged. Run `node src/utils/route.check.mjs` → FAIL.
- [ ] **Step 2:** Implement the route in `route.js` (and its `eventIdOf` pattern). 
- [ ] **Step 3:** `QueueView({ club, base, eventId, uid, navigate })`: members only (`MembersOnly` otherwise, as the other restricted screens); listens to the event doc, `players`, `courts`; shows the event title, "Live" / "This game has ended" (no queue), the queue in order (`queueOrder`) with games played and the person's row marked "You", then each court with the names on it. A back link to the club. No controls. `ClubApp` routes `club-queue` to it inside the shell.
- [ ] **Step 4: Run** the route check; `npm run build`.
- [ ] **Step 5: Commit.**

---

### Task 7: Docs, browser pass, final review

- [ ] Browser (emulators): a host and two members; a member books while signed in, the host approves and proceeds to the game, checks both in; the member's Home shows "Your active session" with the right position; the host starts a match; the card changes to "You're on court N"; View queue shows the list; ending the game removes the card; a non-member and a quick-session user see nothing; a member opening `/clubs/:id/event/:eventId/game` still gets the managers-only notice.
- [ ] `CLAUDE.md`: a bullet for the active queue (the `uid` link, the member read of `players`/`courts`, `queueStatus`, the route). Memory update. Remind the owner to re-publish `firestore.rules`.
- [ ] One whole-branch review by a fresh opus reviewer on the active-queue commits; fix Critical and Important findings with a failing test first; ledger the minors.
