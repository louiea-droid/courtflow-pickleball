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
- Still open: light/dark theme. `styles.css` has ~190 hard-coded hex colors that must move to
  `:root` tokens first.

Still open from the queue and cost ideas:
- Max consecutive games per player. Not built because the queue already sorts by fewest games,
  so anyone who just played drops to the back; only matters with very small queues.
- Avoid repeat opponents (no opponent history is tracked yet; partners only).
- Currency setting (₱ is hard-coded in `money()` and the Live Board).

**Data**
- Export roster and match history to CSV (a safety net before Delete Account).
- Past sessions list: view or delete the archived stats saved by End Session and New Session.
- Import roster from CSV.

**Danger Zone**: keep as is.

**Deliberately skipped**: email or 2FA settings (login is club name plus password), notification
settings (there are no push notifications), multiple staff accounts per club (large auth change).

Also skipped for now: default court level labels per court.
