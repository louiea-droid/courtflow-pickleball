# Player self check-in (2026-11-13)

## Why
Hosts spend the start of a game night checking people in. Players should check themselves in from their phone by
scanning the Live Board, without an account, and only from the venue. Owner-approved mockup:
`.superpowers/brainstorm/*/content/queue-picks.html` (section 3, revised: type your name, no list).

## Approaches
- **QR + a 4-digit code on the Live Board, checked by the rules (picked).** Same pattern as volunteer umpires: the phone
  signs in anonymously and registers with the code; the rules compare it with the game's current code.
- QR only: rejected by the owner (a photo of the QR would work from anywhere).
- A Cloud Function checking the code: not needed; the rules can compare codes. Needs the paid plan.

## Design (club games; the quick session is left out for now, its Live Board has no private channel for the code)
- Host: **Self check-in** switch in Share Live Board (`LiveLinkModal`), with the code and **New code**. Stored at
  `{event}/private/checkin` = `{ on, code }` and copied to `private/live.checkin` (what the Live Board reads).
- Live Board: when on, a "Check in here" panel with a QR of `/checkin?club=C&event=E` (no code in it) and the code.
- Phone page `/checkin` (`Checkin.jsx`, route `checkin`): code (4 digits) -> registers at `{event}/checkins/{uid}` =
  `{ code, at }` -> "Your name" -> matching (`utils/selfCheckin.js`, check file): exact (case / spaces ignored) ->
  "Is this you?"; several fit -> only those; a close typo -> "Did you mean"; already in -> "You're already in, #N";
  none -> new player with a level choice. Then "You're in! #N" and **Check in someone else**.
- Levels: only an unrated player (no valid stars) or a new one picks a level (6 plain choices mapping to 1-6 stars);
  a rated player just checks in and can't change their stars. Self-picked levels set `selfRated: true`; the host sees
  a "self-rated" / "new" tag and any host edit clears it.
- Rules: a registered phone (current code, `on`, game live) may read players, update a player only from not checked in
  to checked in (`checked`, `checkedAt` near now, `breakAt` null, and `skill` + `selfRated` only when the player had no
  valid stars), and create a player with exactly the new-player fields. Test: `tests/checkin.test.mjs`.
- New code: old registrations stop working at once (their code no longer matches); the page asks for the new code.
- Cascade: `checkins` joins `EVENT_SUBCOLLECTIONS`. The rules must be published.

## Non-goals
Checking out or taking a break from the phone, quick sessions, push to the player when it's their turn.
