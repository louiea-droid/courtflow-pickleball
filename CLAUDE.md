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
  `clubs/{clubId}/events/{eventId}` (title, date, startTime, durationMins, maxPlayers, fee, level, notes, payInfo, `attendees[]`,
  status, and the host's `hostName` / `timeZone` copied on so the public page needn't read the private club settings). Routes
  `/clubs/:id/host` (list, `views/Host.jsx`) and `/clubs/:id/event/:eventId` (`views/EventPage.jsx`); writes in `hooks/useEventActions.js`; reads in
  `hooks/useEvents.js`; seat/waitlist/payment logic in `utils/bookings.js` (check: `node src/utils/bookings.check.mjs`).
  Attendees are an array in joined order: the first `maxPlayers` are confirmed, the rest wait (derived).
- Public page `/open-play?club={clubId}` (`OpenPlay.jsx`): lists a public club's upcoming events (public read); a player sends a request to
  `clubs/{clubId}/events/{id}/requests` (not signed in, so `firestore.rules` allows a validated pending create and a single `get`
  by the random request id; only the host can list/update). Approving adds the attendee (attendee id = the request's public `seatId`, never the
  request id, so the public attendee list can't reach a phone number; `createdAt` must be within 10 min of server time because it
  sets the place in line) so the player's page shows confirmed / waitlist / paid. Request and seat ids live in the player's localStorage. Phone numbers stay in the
  request doc, never on the event. QR codes use `qrcode` (`QrCode.jsx`).
- Delete account cascade: `utils/accountData.js` (`deleteAccountData`, `EVENT_SUBCOLLECTIONS`; step 3 adds the game
  subcollections there). Test: `tests/cascade.test.mjs` via `npm run test:rules`. Rules must be re-published in the Firebase
  console after any change to `firestore.rules`.
- Game on an event (step 3a, spec `docs/superpowers/specs/2026-10-07-event-game-design.md`): `QueueApp.jsx` is the queue app on a `base`
  path (`utils/paths.js`: `sessionBase(uid)` for the quick session, `eventBase(clubId, id)` for a game); every write goes through its `at` /
  `col` helpers. `QuickSession.jsx` wraps it at `/club`; `Game.jsx` at `/clubs/:id/event/:eventId/game` (gates on event `status`, merges the club settings with
  `buildGameSession`). "Proceed to game" (`GamePickModal`, nothing pre-ticked) adds the ticked attendees as players NOT checked in, sets the
  event `live`, creates courts from the club's Session defaults and one booking-fee Cost entry (`booking-{eventId}`); "Add players to game"
  repeats it safely (players are matched by attendee id). "Play now" makes a `walkIn` event (4 h, no seats, hidden from the public page).
  "End game" sets `status: "ended"` and keeps everything; "Reopen game" sets it `live`. Pure logic and its check: `utils/gameSession.js`,
  `node src/utils/gameSession.check.mjs`; writes in `hooks/useGameActions.js`. Game data (`players`, `courts`, `matchLog`, `costs` under an
  event) is managers-only (rules don't cascade into subcollections); step 4 opens read for the Live Board. Delete cascade covers all of it
  (`EVENT_SUBCOLLECTIONS`).
- Still to build: the roster and skill memory (now per club, after clubs part A), clubs parts B and C, per-event Live Board links and the landing page (step 4).
- Accounts (step 1 of `docs/superpowers/specs/2026-10-06-accounts-and-events-design.md`): real Firebase accounts
  (email + password or Google) with a profile at `accounts/{uid}` (owner-only in `firestore.rules`). `main.jsx` picks the page
  with `routeOf` in `utils/route.js`: `/live`, `/open-play`, `/club` (the quick session, below), everything else is
  `AccountApp` (sign-in, hub, profile, and `ClubApp` under `/clubs/:id`). Old club logins (`@courtflow.local` emails) are never accounts (`isAccountUser` in
  `utils/account.js`) and own nothing in the rules. Club settings reuse `Settings.jsx` with `mode="club"`. Account
  delete wipes `roster` and `events` (step 2 adds each event's subcollections to the cascade in `useAccount.js`).
  Checks: `node src/utils/account.check.mjs`, `node src/utils/route.check.mjs`, `npm run test:rules` (emulator, needs Java).
  Steps 2-4 (events, roster + proceed to game, per-event public pages) each get their own plan.
- Clubs (part A of `docs/superpowers/specs/2026-10-08-clubs-design.md`): people create clubs (`clubs/{id}`, public or private) and the club owns its settings, events, games and (later) roster; the account is only the person's profile (`accounts/{uid}`: name, email, `display.theme`, plus `memberships/{clubId}` copies that power "My clubs"). A person's role is the club's own `members/{uid}` record (`owner` / `manager` / `member`); `utils/clubs.js` holds the pure rules (`permissions`, `validateClubInput`, `newClubDoc`; check: `node src/utils/clubs.check.mjs`) and `firestore.rules` enforces the same table (public clubs: events readable and bookable by anyone; private: members only; game data under an event is managers-only). Routes: `/` hub, `/clubs/new`, `/clubs/:id`, `/clubs/:id/host`, `/clubs/:id/event/:eventId[/game]`, `/clubs/:id/settings`, `/settings` = profile; `/club` is still the quick session (route name `quick`). `AccountApp` is sign-in + hub + profile; `ClubApp` is everything under a club and applies the club's theme and time zone. Deleting a club or an account that owns clubs goes through `utils/accountData.js` (`deleteClubData`, `deleteAccountData`; test: `tests/cascade.test.mjs`). Parts B (joining) and C (managers) are built, see below.
- Hub and club screens share one frame (`docs/superpowers/specs/2026-10-08-account-club-ui-design.md`): `AccountSidebar` on every screen (a dark sidebar like the queue app's, a drawer behind a menu button under 860px: brand, Home, Play (Find a club), Your clubs (the open club expands in place to its screens Overview, Open play, Members, Settings, which `ClubApp` passes as data), and the account menu at the bottom; creating a club and the quick session live on Home), `PageTitle` for titles and page actions, a club name and pills header in `ClubApp`, forms capped with `.page-narrow`. Styles for all of it live in `src/clubs.css` under `.acct-shell` / `.acct-side` (never in `styles.css`), so the queue app, public page and Live Board stay unchanged. Neutral buttons are `.outline` (ink text, also for links); `.primary` once per screen region. The global `nav{flex-direction:column}` rule in `styles.css` means any new horizontal `nav` must set `flex-direction:row` itself (the sidebar's navs are vertical on purpose).
- Clubs part B (`docs/superpowers/specs/2026-10-08-clubs-part-b-design.md`): joining. A person asks to join a public club (`clubs/{id}/joinRequests/{uid}`, pending or declined) or joins any club with its invite link (`/clubs/:id?invite=CODE`; the code lives in `clubs/{id}/private/invite` and travels on the new member record, which the rules compare to the current code, so a reset stops old links). A manager approves with one batch (member record + the person's `accounts/{uid}/memberships/{clubId}` card + the request); the rules mirror the card write with `getAfter` / `existsAfter`, so a manager can only create or delete a card in the same batch as the member-record change. Screens: `/clubs/find` (public clubs, up to 200, filtered on the device; no index), the join panel (`JoinPanel`) on the club page for non-members, and the Members tab (`ClubMembers`: requests, invite link, remove, leave). Pure helpers: `utils/clubs.js` (`newInviteCode`, `inviteUrl`, `filterClubs`, ...); rules test: `tests/membership.test.mjs`. Deleting a club removes every member's card; deleting an account leaves its clubs first (`leaveClub`). A stale card cleans itself up after a 2.5 s check in `ClubApp`. `useClubDoc` ignores a member record with pending writes, so an invite join the rules refuse never flips the screen to the member view and back. The new rules must be published in the Firebase console.
- Clubs part C (`docs/superpowers/specs/2026-10-08-clubs-part-c-design.md`): managers. Only the owner changes a role (member / manager) from the Members tab: one batch updates `members/{uid}.role` and the person's card, and the card rule compares the card's role with `getAfter` of the member record. The owner also has a manager link (`?manager=CODE`, code in `clubs/{id}/private/managerInvite`, owner-only; the rules check it for a `role: 'manager'` join) that makes managers; the members link in `private/invite` stays managers-only. `private/{id}` is one wildcard match so the owner can list the folder when deleting the club. Pure helpers: `canChangeRole`, `canRemove` in `utils/clubs.js`. The rules must be re-published again.
- Active queue (`docs/superpowers/specs/2026-10-09-active-queue-design.md`): Home shows "Your active session" while the person is a checked-in player in a live game at one of their clubs (position, players ahead, about N min, View queue). A player doc may carry `uid`: from a signed-in booking (`OpenPlay` puts the account id on the private request, never on the public attendee; "Proceed to game" copies it with `uidBySeat`) or picked by the host in the add-player form (`memberChoices`). Club members can read a live game's `players` and `courts` (rules; they carry names, skill, gender), not `matchLog`, `costs` or `requests`. `utils/queueStatus.js` (`queueStatus`, `queueOrder`; check: `node src/utils/queueStatus.check.mjs`) is the default queue order, so Winners / Losers, Custom and Mixed Doubles can differ from the estimate. The card is `components/ActiveQueue.jsx` (one live-events query per club, no index; the section hides with CSS `:has`); the read-only page is `/clubs/:id/event/:eventId/queue` (`views/QueueView.jsx`, route `club-queue`, members only). The rules must be re-published again.
- Local emulators: `npm run emulators` (Auth + Firestore, project `demo-courtflow`) and `npm run dev:emu` (Vite on port 5300 pointed at them, `.env.emulator`): no real data, no published rules needed. Use them for browser checks.
- Quick session at `/club`: the classic queue app with no login. `useClub` signs the visitor in anonymously (or reuses the real
  account already signed in, never signing it out) and keeps the session at `sessions/{uid}`; rules: `isClub` = `auth.uid == sessionId`.
  Data belongs to that browser (clearing site data starts fresh). Needs Anonymous sign-in turned on in the Firebase console.
  Settings uses `mode="quick"` (no password rows; "Erase this session"). "Back to home" is a button in the sidebar; End Session archives the stats and then goes to the home page (`/`). The page is `QuickSession.jsx` (`useClub`) around `QueueApp`; its route name is `quick`.
- Modes (`utils/rotationModes.js`, check: `node src/utils/rotationModes.check.mjs`): Balanced, Skill Separated, Custom (manual: nothing is picked or rotated by itself), Winners / Losers (winners always stay on until `rules.maxWinStreak` wins in a row, default 2, set in Settings; then they go to the back of the queue; challengers are recent winners first), Mixed Doubles (every team is one man + one woman: players with no gender are never picked and show a "!"; locks only pair a man with a woman, manual moves that break it are refused). Skill Courts was removed (saved sessions move to Balanced via `normalizeMode`). Per-court levels work in every mode.
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
