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
