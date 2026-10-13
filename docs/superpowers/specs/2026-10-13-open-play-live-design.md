# Open play live: a Live Board per game, and live scores on the booking page

Owner's pick (2026-10-13): both. Builds on umpire scoring (`2026-10-13-umpire-scoring-design.md`); it is step 4's
"per-event Live Board links" from the accounts spec.

## 1. A Live Board for each open-play game

The same TV board as the quick session (courts with live scores, the queue with "Next", the match log), for a game at
`clubs/{c}/events/{e}`.

- **Link:** `/live?club={clubId}&event={eventId}&key={key}` (the quick session keeps `/live?club={uid}[&key=]`). The host
  shares it from the game's top bar (**Share Live Board**, now shown for games too) with the link and a QR code, and can
  make a **New link**.
- **Why a real key, not a page gate:** a game's players and courts are readable only by managers and club members, and an
  anonymous screen can't even read a private club's document. So the board works like the umpire link:
  - The TV signs in anonymously (or reuses a signed-in account), and registers at `events/{e}/viewers/{uid}` =
    `{ key, at }` with the key from the link. The rules check that the key equals `events/{e}/private/live.key`.
  - A registered viewer may read the game's `players`, `courts` and `matchLog`, and `get` `private/live`. Nothing else,
    and nothing writable. Costs stay hidden.
  - **New link** replaces the key and deletes every viewer registration, so every old screen stops at once.
  - Viewing works while the game is `live` and for 12 hours after it ends, so a board left on shows the final results.
    After that, or when the event is deleted, it shows "This Live Board is no longer active".
- **What the board needs that a viewer can't read** (the event doc holds payment details; a private club's doc is
  members-only) is copied into `private/live` when the link is made and whenever the host opens the share panel:
  `{ key, clubName, title, date, format, mode, display, live }` (`display` = theme, colors, time zone; `live` = show skill
  stars, queue position, games and wins).
- **Page:** `LiveBoard.jsx` gets a second data source. With `event=` it reads through the viewer path above, and otherwise
  it reads the quick session as today. Everything shown (courts, scores, queue, Next, match log, wake lock) is shared.

## 2. Live scores on the public booking page

On `/open-play?club={id}` (public clubs), a game in progress gets a **Live now** strip on its card: one chip per court
with a match, e.g. `Court 1  7 - 5`, in team colors, updating live. The cards stay plain links and show no player names.

- **Rules:** `courts` under an event become readable by anyone when the club is public. Court docs hold only player ids,
  the level, the start time and the score. Players, the match log and costs stay as they are.
- Walk-in games are still hidden from the public page, and a live game still leaves the page once its scheduled time
  passes (existing rule, unchanged).
- Find session cards (`SessionCard`) are unchanged in this step.

## Tests

- **Rules** (`tests/live.test.mjs`):
  - A viewer with the current key reads players, courts and the match log. An old key, no registration, or an expired
    ended game is refused.
  - Viewers write nothing besides creating and deleting their own registration.
  - Public club courts are readable by anyone. Private club courts are not.
- **Pure helpers** (`utils/liveBoard.js`, check): link building and parsing (`liveUrl`, `liveTarget`), the 12-hour window
  after an ended game, and the court chips for the booking page.
- **Browser:**
  - The TV board in a separate browser at TV, tablet and phone sizes.
  - New link stops it.
  - The booking page shows the live strip on a phone.

## Not in this version

- A members-only Live Board without a link.
- Live scores on Find session cards.
- Player names on the public booking page.
- A history of past games on the board.
