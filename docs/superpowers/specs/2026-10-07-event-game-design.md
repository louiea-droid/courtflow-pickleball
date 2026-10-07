# Run the game on an event (step 3a)

Date: 2026-10-07. Status: draft for owner review.
Parent spec: `2026-10-06-accounts-and-events-design.md` (build-order step 3). The account roster is split out as step 3b and is not part of this spec.

## Goal

A host opens an event, taps "Proceed to game", picks who is here, and runs the existing queue (courts, check-in, winners, costs, stats) scoped to that event. "Play now" starts a game with no booking. "End game" closes it without wiping anything. The quick session at `/club` keeps working exactly as it does today.

Decided with the owner:
- Step 3 is split: 3a is this spec (game on an event), 3b is the roster (skill and partners remembered across events).
- "Proceed to game" opens a manual pick list of the joined list and the waitlist, with paid status shown. Nothing is ticked when it opens. Ticked players are added to the game **not checked in**; the host taps each in as they arrive.
- End game keeps all data; it does not archive-and-wipe.

Out of scope: the roster and skill memory (3b); per-event Live Board link and QR (step 4); changes to the quick session; recurring events.

## Approach

The queue app already does everything; it is only tied to the path `sessions/{id}`. Parameterise the path instead of copying the app.

- New `src/utils/paths.js`: `sessionBase(uid)` returns `["sessions", uid]`, `eventBase(uid, eventId)` returns `["accounts", uid, "events", eventId]`. A base is the document that acts as "the session". Its subcollections are `players`, `courts`, `matchLog`, `costs` (and `history` for the quick session only).
- `useSessionData`, `useCosts`, `useMatchLog` take a `base` (array) instead of a `sessionId`. Their effect keys on `base.join("/")`. `useSessionHistory` stays quick-session only.
- The ~40 writes in `App.jsx` that hard-code `doc(db, "sessions", SESSION_ID, ...)` go through two helpers, `docAt(base, ...rest)` and `colAt(base, name)`. This is a mechanical replacement; the logic around the writes does not change.
- `App.jsx` becomes `QueueApp({ base, session, mode, ... })`: a presentational shell that receives the base path and the merged `session` object and no longer calls `useClub` itself. Two thin wrappers:
  - `Club.jsx` (mounted at `/club`): `useClub` as today, `mode="quick"`, `base = sessionBase(uid)`.
  - `Game.jsx` (mounted by `AccountApp` at `/event/:id/game`): account + event, `mode="event"`, `base = eventBase(uid, id)`.
- Rejected: copying `App.jsx` into an event version (two diverging 700-line components) and a separate event-only data layer (the hooks already isolate the path).

## Data

No new collections and **no rules changes**. Firestore rules do not cascade into subcollections, so `players`, `courts`, `matchLog` and `costs` under an event are owner-only (the `accounts/{uid}/{document=**}` rule); only the event document and `requests` have public rules. That is deliberately kept for 3a: nothing public needs the game data until the Live Board in step 4, which will open read access. The rules test pins it (the owner can write all four; a stranger can neither read nor write them).

Event document additions (all optional, so existing events are valid):

| Field | Meaning |
|---|---|
| `status` | `scheduled` (exists today) → `live` → `ended`. Reopen sets it back to `live`. |
| `courts`, `format`, `mode`, `autoRotate` | The game's settings, written when the game starts, edited in the game. These are the same names the queue app already reads from the session doc. |
| `startedAt`, `endedAt` | Epoch ms. |
| `walkIn` | `true` for a Play now event. |

The merged session the queue app sees (pure function `buildGameSession(account, event)` in `src/utils/gameSession.js`):
`{ ...event fields above, location: event.title, rules, costDefaults, live, display, defaults }`, where the last five come from the account document with the existing `DEFAULT_*` fallbacks. Account-wide settings stay in the account; the Settings page is unchanged.

Players in the game are docs at `events/{id}/players/{playerId}` with the existing shape (`name`, `skill`, `gender`, `checked`, `checkedAt`, `createdAt`, `games`, `wins`, `losses`, `partners`, `lastResult`, `lockedWithId`). A player who came from a booking uses the attendee's id as the doc id (the public seat id), so starting the game twice cannot add anyone twice. Walk-ins added in the game get a random id as today.

## Proceed to game

Shown on the event page when status is `scheduled` or `live` ("Proceed to game" first time, "Back to game" once live). For `ended` the button is "Reopen game".

1. A modal lists the joined list, then the waitlist, each with a tag: Paid, Unpaid, Refunded or Waitlist #n. Nothing is ticked. Above the list: "Select all joined", "Select all paid", "Clear". Attendees already in the game are greyed and tagged "In the game".
2. "Start game" (or "Add to game" when already live), disabled until at least one player is ticked on the first start:
   - On the first start, set `status: "live"`, `startedAt`, and the game settings from the account's Session defaults, and create `court-1..N`.
   - Create a player doc (`checked: false`, zeroed stats, default skill and gender) for each ticked attendee not yet in the game.
   - Create or update one Cost entry for the booking fee, covering the ticked players and carrying who has already paid (the shape of the entry the old "Check in to the queue" wrote; the plan reads it from git history and reuses the same fields). Its id is deterministic (`booking-{eventId}`) so a second "Add to game" updates it rather than adding another.
3. Navigate to `/event/:id/game`, Queue tab.

Pure, unit-checked logic lives in `src/utils/gameSession.js`: `buildGameSession`, `playersToAdd(event, pickedIds, existingPlayers)`, `bookingCostEntry(event, picked)`, `gamePickList(event, existingPlayers)`.

## Play now

A "Play now" button on the `/host` toolbar, next to "New open play". It creates an event with `title: "Play now"`, today's date in the account's time zone, the current time rounded down to the quarter hour, `durationMins: 240`, `fee: 0`, `maxPlayers: 0`, `walkIn: true`, `status: "live"` and the game settings, plus the courts, then opens `/event/:id/game`. There is no pick list. The host adds walk-ins in the game as the classic app does. `Host.jsx` shows a "Walk-in" tag instead of the joined and paid counts for these events.

## In the game (`mode="event"` differences from `mode="quick"`)

- Same Dashboard, Queue, Players, Cost, Stats and Guide tabs, same actions, same undo.
- Topbar eyebrow shows the event title and date instead of "OPEN PLAY SESSION". The Sidebar's location line shows the event title.
- The in-game Settings tab is hidden (account settings live at `/settings`). Courts, format and mode stay changeable from the Dashboard and Sidebar as today and are written to the event.
- "New Session" does not exist. The Sidebar's "End Session" becomes "End game": it sets `status: "ended"` and `endedAt`, then navigates to the event page. It does **not** reset players, clear courts, or delete the match log or costs. Everything stays for the event page and Stats.
- "Share Live Board" is hidden until step 4 provides a per-event link.
- Stats shows this game's current data only (no history list); the history subcollection is a quick-session feature.
- A "Back to event" link replaces "Back to home" in the Sidebar.

Event page additions: a game line when `live` ("Game in progress, N checked in") or `ended` ("N players, M games, ended {time}") with "Back to game" / "Reopen game". Counts come from the event's `players` and `matchLog`.

## Routes

`routeOf` gains `"game"` for `/event/<id>/game` (trailing slash tolerated, anything deeper falls back to the hub). `eventIdOf` also returns the id from `/event/<id>/game`. `useRoute`, the header nav ("Open play" active for `host`, `event` and `game`), and deep links work as for `/event/:id`. An unknown event id at `/event/<id>/game` shows the same not-found as the event page with a way back.

## Delete and cascade

`EVENT_SUBCOLLECTIONS` becomes `["requests", "players", "courts", "matchLog", "costs"]`. Deleting an event or an account wipes them all, and `tests/cascade.test.mjs` is extended to seed every subcollection and assert nothing is left. The event delete confirmation also mentions game data.

## Testing

- `node` checks (new `gameSession.check.mjs`, extended `route.check.mjs`): the session merge and its defaults; pick-list tags and the already-in-game state; `playersToAdd` is idempotent and uses attendee ids; the cost entry covers only picked players and carries paid status; `routeOf` and `eventIdOf` for the game route.
- Emulator (`npm run test:rules`): the subcollection rules cases and the extended cascade.
- Browser, signed in on the dev server: create an event with bookings, Proceed with a mixed pick, check players in, record a win, undo it, add a walk-in, End game, reopen, Play now, delete the event. Repeat one pass of `/club` to confirm the quick session is unchanged (add a player, check in, record a win, End Session archives as before).

## Risks

- **Regressions in the quick session.** The `App.jsx` refactor touches every write. Mitigation: mechanical helper replacement only, a browser pass on `/club` before and after, and no logic edits in the same task.
- **Event doc and session doc share field names.** `courts` is a number on the doc and also a subcollection name; this already holds for the session doc, so reading code is unchanged.
- **Player names stay private in 3a** (see Data). Step 4 decides what the Live Board may read and opens exactly that.
- **Reopen after End game** leaves old games and new games in one set of stats. Accepted; the host can still delete the event.
