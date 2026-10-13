# Open Play Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, chosen by the owner for this project). Steps use checkbox (`- [ ]`) syntax.

**Goal:** A Live Board link for each open-play game, and live court scores on the public booking page.

**Architecture:** A TV registers as a viewer with the link key, like the umpire link: `events/{e}/viewers/{uid}` holds the key, and
the rules compare it with `events/{e}/private/live.key`. A registered viewer reads the game's players, courts and match log. What the board
needs from the event and the club is copied into `private/live`. The booking page reads a public club's court docs.

**Spec:** `docs/superpowers/specs/2026-10-13-open-play-live-design.md`

## Global Constraints
- Same as the umpire plan: tokens only, `styles.css` for queue / Live Board styles, test at 390 px and desktop, `ponytail:` notes for shortcuts.
- The rules must be re-published after this ships.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `src/firebase.js` carries a local port patch during browser checks; never commit it.

## Review Focus
1. **A board left on after End game:** it keeps working for 12 hours, then shows "no longer active". The rules test covers both sides of the window.
2. **New link while a TV is showing:** the TV stops at once, and a fresh load with the old link is refused. Covered by the rules test and the browser check.
3. **Private club:** the board must work without reading the event or club docs. Covered by the rules test (a viewer can't read the event doc) and by the board reading only `private/live`.
4. **Booking page for a private club:** court docs stay members-only. Covered by the rules test.
5. **Live strip with no scored court:** it shows "Game in progress" with no chips. Covered by the `liveChips` check.

### Task 1: Pure helpers
- `src/utils/liveBoard.js` + `liveBoard.check.mjs`:
  - `liveUrl(origin, clubId, eventId, key)` builds the link.
  - `liveTarget(search)` reads a link: `{ kind: "event", base, key }`, `{ kind: "quick", base, key }` or null.
  - `liveChips(courts)` lists the courts with a current score and players: `[{ id, name, t1, t2 }]`.
  - `LIVE_AFTER_END_MS` is 12 hours.

### Task 2: Rules and their test
- **Under `clubs/{c}/events/{e}`:**
  - `viewers/{uid}`: create your own `{ key, at }` with the current key while the game can be viewed; `get` and delete your own record.
  - `private/{id}`: a viewer may `get` `live`.
  - A viewer may read `players`, `courts` and `matchLog`.
  - `courts` are readable by anyone when the club is public.
- **Viewable:** `status == 'live'`, or `status == 'ended'` and `endedAt` is within 12 hours.
- **Tests:** `tests/live.test.mjs` (added to `test:rules`), and `cascade.test.mjs` plus `EVENT_SUBCOLLECTIONS` gain `viewers`.

### Task 3: Data and the host's share modal
- **`src/utils/liveData.js`:** `createLiveLink`, `renewLiveLink` (also deletes viewers), `syncLiveInfo`, `joinAsViewer` (deletes a stale record of your own first).
- **`useUmpireLink(base, docId = "umpire")`:** also reads `private/live`.
- **`components/LiveLinkModal.jsx`:**
  - Shows the link, a QR code and a New link button.
  - Syncs the info into `private/live` when opened: `{ key, clubName, title, date, format, mode, display, live }`.
- **`QueueApp`:** Share Live Board is shown for games too and opens this modal. `Game.jsx` passes `clubName`.

### Task 4: Live Board reads a game
- **`LiveBoard.jsx`:** with `event=`, the board signs in anonymously, joins as a viewer, then listens to players, courts, the match log (newest 30) and `private/live`. A refused join or read shows "This Live Board is no longer active".
- The quick-session path is unchanged. Rendering is shared.

### Task 5: Live strip on the booking page
- **`OpenPlay.jsx`:** an `EventCard` for a game in progress gets a `LiveStrip` that listens to that event's courts and shows the chips (court name and the score in team colors), or "Game in progress".

### Task 6: Docs and verification
- **CLAUDE.md bullet:** the per-event Live Board and the booking-page strip. Update the umpire note that the Live Board score shows "quick session now".
- **Checks:** all check scripts, all rules suites and the build.
- **Browser:** the TV board in a separate origin at TV and phone sizes; New link stops it; the booking page strip on a phone.
