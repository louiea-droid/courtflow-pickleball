# CourtFlow

## Skills

Always invoke the matching skills in `.claude/skills` with the Skill tool, even when not asked:
- UI or design work: `frontend-design`, `ui-design-system`, `ui-ux-pro-max`.
- React or frontend code: `senior-frontend`, `react-best-practices`.
- Theming (palettes, light/dark theme): `theme-factory`, plus the design skills.

## Settings backlog (Settings page)

Ideas the owner approved for later.

Already built:
- Club settings, and Session defaults (courts, format, mode on `session.defaults`, pre-filled by New Session).
- Queue rules on `session.rules` (defaults in `DEFAULT_RULES`): game length alert, winners stay on
  with a win-streak cap (tracked on the court doc as `winStreak` / `stayingIds`), avoid repeat partners.
- Cost defaults on `session.costDefaults`: default court rate, round each share up (`splitCost`).
- Live Board on `session.live` (defaults in `DEFAULT_LIVE`): on/off, new link (`?key=`), show/hide
  skill stars, queue position, games and wins. This only gates the Live Board page; Firestore
  reads are public, so the data itself is still readable by anyone who knows the club id.
- Display on `session.display`: time zone and 12/24h clock, applied through `applyDisplayPrefs`
  in `utils/format.js` (all times go through `formatTime` / `formatClock` / `formatDate`).
- Theme on `session.display` (`theme`: light / dark / system; `accent`, `team1`, `team2`: hex), applied by
  `applyTheme` in `utils/theme.js` and cached in localStorage for a no-flash load (`index.html`).
  Colors are `light-dark()` tokens on `:root` in `styles.css`; accent tints derive from `--accent`
  via `color-mix()`. Use tokens for new colors, never raw hex (the sidebar is dark in both themes).

- Live Board keeps the screen awake (Wake Lock, re-requested when the tab is shown again).
- Firestore offline cache (`persistentLocalCache`, multi-tab) in `firebase.js`.
- Readable text on theme colors: `readableOn` in `utils/theme.js` sets `--on-accent` / `--on-team1` /
  `--on-team2` (white unless under 3:1; check: `node src/utils/theme.check.mjs`).
- Undo a match result: `recordWin` snapshots what it changes; the toast offers Undo for 10s.

- Events (step 2 of `docs/superpowers/specs/2026-10-06-accounts-and-events-design.md`): an open play is a doc at
  `accounts/{uid}/events/{eventId}` (title, date, startTime, durationMins, maxPlayers, fee, level, notes, payInfo, `attendees[]`,
  status, and the host's `hostName` / `timeZone` copied on so the public page needn't read the private account doc). Routes
  `/host` (list, `views/Host.jsx`) and `/event/:id` (`views/EventPage.jsx`); writes in `hooks/useEventActions.js`; reads in
  `hooks/useEvents.js`; seat/waitlist/payment logic in `utils/bookings.js` (check: `node src/utils/bookings.check.mjs`).
  Attendees are an array in joined order: the first `maxPlayers` are confirmed, the rest wait (derived).
- Public page `/open-play?host={uid}` (`OpenPlay.jsx`): lists a host's upcoming events (public read); a player sends a request to
  `accounts/{uid}/events/{id}/requests` (not signed in, so `firestore.rules` allows a validated pending create and a single `get`
  by the random request id; only the host can list/update). Approving adds the attendee (attendee id = the request's public `seatId`, never the
  request id, so the public attendee list can't reach a phone number; `createdAt` must be within 10 min of server time because it
  sets the place in line) so the player's page shows confirmed / waitlist / paid. Request and seat ids live in the player's localStorage. Phone numbers stay in the
  request doc, never on the event. QR codes use `qrcode` (`QrCode.jsx`).
- Delete account cascade: `utils/accountData.js` (`deleteAccountData`, `EVENT_SUBCOLLECTIONS`; step 3 adds the game
  subcollections there). Test: `tests/cascade.test.mjs` via `npm run test:rules`. Rules must be re-published in the Firebase
  console after any change to `firestore.rules`.
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
- Accounts (step 1 of `docs/superpowers/specs/2026-10-06-accounts-and-events-design.md`): real Firebase accounts
  (email + password or Google) with a profile at `accounts/{uid}` (owner-only in `firestore.rules`). `main.jsx` picks the page
  with `routeOf` in `utils/route.js`: `/live`, `/open-play`, `/club` (the quick session, below), everything else is
  `AccountApp` (sign-in, hub, settings). Old club logins (`@courtflow.local` emails) are never accounts (`isAccountUser` in
  `utils/account.js`) and own nothing in the rules. Account settings reuse `Settings.jsx` with `mode="account"`. Account
  delete wipes `roster` and `events` (step 2 adds each event's subcollections to the cascade in `useAccount.js`).
  Checks: `node src/utils/account.check.mjs`, `node src/utils/route.check.mjs`, `npm run test:rules` (emulator, needs Java).
  Steps 2-4 (events, roster + proceed to game, per-event public pages) each get their own plan.
- Quick session at `/club`: the classic queue app with no login. `useClub` signs the visitor in anonymously (or reuses the real
  account already signed in, never signing it out) and keeps the session at `sessions/{uid}`; rules: `isClub` = `auth.uid == sessionId`.
  Data belongs to that browser (clearing site data starts fresh). Needs Anonymous sign-in turned on in the Firebase console.
  Settings uses `mode="quick"` (no password rows; "Erase this session"). "Back to home" is a button in the sidebar; End Session archives the stats and then goes to the home page (`/`). The page is `Club.jsx` (`useClub`) around `QueueApp`.
- Small rules worth knowing: Esc closes the top dialog (`hooks/useEscape.js`, used by `Modal` and the confirm dialogs); "matches" = player-games / 4 for doubles, / 2 for singles (`utils/stats.js`); the player's payment reference lives on the private request, never on the public event; `deleteEventData` removes the event doc first, then its subcollections; a live game stays on the host list until ended, but the public page stops listing it once its scheduled time passes.

Saved for later (owner's picks, in order of suggestion):
- Export roster and match history to CSV (safety net before Delete Account).
- Past sessions list: view or delete archived stats from End Session / New Session.
- Currency setting (₱ hard-coded in `money()` and the Live Board).
- Player self check-in by QR code on the Live Board. Design discussed with the owner (no option
  picked yet):
  - Flow: the Live Board shows a QR code; a player scans it, a simple phone page lists the roster
    (or a search box), they tap their name and "Check in", and they join the queue live. Optional:
    a new player types their name to add themselves; staff set the skill level later.
  - The catch: `firestore.rules` only lets the club's own Firebase Auth account write, and a
    player's phone isn't signed in, so a new write path is needed.
  - Option A (simple): rules allow anyone with the link to change only a player's checked-in
    field. Weakness: the QR is effectively public, so a photo of it works from anywhere. Reuse the
    Live Board "New Link" (`?key=`) to replace an old QR code.
  - Option B (recommended): a 4-digit code that changes every session, shown beside the QR code;
    check-ins must include it, so people have to be at the venue. Checked by a Firebase
    Cloud Function, not the rules. Needs Firebase's pay-as-you-go plan (cost at club scale ~zero).
  - Either way it changes the security rules, so build it as its own project.
- Tighten Firestore reads (club data is readable by anyone who knows the club id).

Still open from the queue and cost ideas:
- Max consecutive games per player. Not built because the queue already sorts by fewest games,
  so anyone who just played drops to the back; only matters with very small queues.
- Avoid repeat opponents (no opponent history is tracked yet; partners only).

**Data**
- Import roster from CSV.

**Danger Zone**: keep as is.

**Deliberately skipped**: email or 2FA settings (login is club name plus password), notification
settings (there are no push notifications), multiple staff accounts per club (large auth change).

Also skipped for now: default court level labels per court.
