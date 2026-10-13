# Umpire scoring

Approved in chat 2026-10-13. An umpire keeps the live score of a court's current match from a phone; the score shows on
the Dashboard and the Live Board, and confirming the end of the game records the result through the existing `recordWin`.

## Who scores

- **Managers** (and the quick-session owner): a **Score** button on each Dashboard court card opens the umpire screen for
  that court. Their writes already pass the rules.
- **Volunteers, no account**: the host (event game) or the owner (quick session) gets an **Umpire link + QR code**; in the
  quick session it sits behind an **Allow volunteer umpires** switch in Settings (off by default, the owner decides).
  The link is `/umpire?game={clubId}.{eventId}` (event) or `/umpire?game={uid}` (quick session), plus `&code={code}`. The page
  signs the visitor in anonymously (as `useClub` does; a signed-in account is reused, never signed out), asks for a name and
  writes `{base}/umpires/{uid}` = `{ code, name, at }`. **New link** replaces the code (`{base}/private/umpire`, managers /
  owner only), so every old link and registered umpire stops at once. An ended game, or the switch turned off, refuses
  umpire writes.

## One umpire per court

- A court has at most one umpire, held in `{base}/courtClaims/{courtId}` = `{ uid, name }`.
- A volunteer opens the link, picks a free court and **claims** it. A claim is a create, so two people can't take the same
  court (the rule only allows creating a missing doc). They can **release** it, and only see and score the court they hold.
- A manager sees who holds each court (court card: "Umpire: Sam"), can **release** it, or **assign** a registered umpire
  (list from `umpires`, by name) to a court, replacing the holder. Managers score any court without a claim.
- A claim stops working when the umpire record is removed or the code is renewed (the rule checks the record's code).

## Scoring logic (`utils/scoring.js`, pure, check `node src/utils/scoring.check.mjs`)

State on the court doc: `score = { start, t1, t2, serving, server, style, to, log }`.

- `start` copies `court.start`. A score whose `start` differs from the court's is stale and reads as a fresh 0-0, so no
  writer that puts a new match on a court has to clear it.
- `style`: `"sideout"` (default) or `"rally"`; `to`: 11 (default), 15 or 21; win by 2. Taken from `session.rules`
  (`scoreStyle`, `scoreTo`; Settings rows under Queue rules) when the match's first rally is scored.
- `rally(score, team)`: the team that won the rally.
  - Side-out doubles: serving team wins, +1 and the same server serves again. Receiving team wins: server 1 -> server 2,
    or server 2 -> side out (the other team serves, server 1). A game starts at 0-0-2 (first serving team gets one server).
  - Singles side-out: no server number; receiving team wins = side out.
  - Rally: the rally winner gets +1 and serves.
- `undo(score)`: steps back one rally (`log` holds the previous states, last 50).
- `adjust(score, team, +1|-1)`: manual correction, never below 0; it is logged so Undo reverses it too.
- `call(score)`: the spoken score, "4 - 2 - 1" (serving team first; no server number in singles or rally).
- `status(score)`: `null`, `"game point"` for a team, or the winner once a team has `to` or more and leads by 2.

## Ending a game

- At a winner the umpire screen asks **"Team 1 wins 11-7?" -> Confirm** (or keep scoring if it was a mistake: Undo).
- A manager's Confirm calls `recordWin(courtId, side, null, { t1, t2 })`; `recordWin` writes the score onto the
  `matchLog` entry (`score: "11-7"`, winners first). Everything else (rotation, streaks, toast Undo) is unchanged.
- A volunteer cannot write players or the match log, so their Confirm writes `score.final = "A" | "B"` (still only the
  `score` field). The Dashboard court card then shows **"Umpire: Team 1 won 11-7 - Record"**; one tap records it.
  Nothing records by itself (two open Dashboards would record twice).

## Screens

- **Umpire screen** (phone first; managers inside the queue app, volunteers on `/umpire`): a court picker (court name and
  the four names), then the called score large, the two teams' names in team colors, two big **Rally won** buttons,
  **Undo**, a small **Adjust** row, and the game-point / winner banner. Team colors use the `--team1` / `--team2` and
  `--on-team1` / `--on-team2` tokens.
- **Dashboard**: each court card shows the live score ("7 - 4 - 2", serving side marked) while one exists.
- **Live Board**: the same score, big, on each court. Quick-session Live Board now; event Live Boards when step 4 adds them.

## Rules (`firestore.rules`, re-publish after)

For both bases (`sessions/{uid}` and `clubs/{c}/events/{e}`):
- `private/umpire` `{ code }`: managers / owner only. Quick sessions are public-read today, so `private` joins
  `bookingRequests` as owner-only read.
- `umpires/{uid}`: create by `request.auth.uid == uid` when `code` equals the current code and the game is live (event) or
  volunteer umpires are on (quick session); delete by that uid or a manager.
- `courtClaims/{courtId}`: read by an umpire record holder or a manager; create (only if missing) by an umpire with
  `uid == request.auth.uid`; delete by the holder or a manager; managers may also write (assign).
- A court update by a non-manager is allowed only when `affectedKeys().hasOnly(['score'])`, the caller holds the court's
  claim, their umpire record's code is current, and the game is live / switch on. Umpires read `players` and `courts`.

Test: `tests/umpire.test.mjs` (`npm run test:rules`): the claim holder scores; a second claim on the same court, another
court, an old code, an ended game or any field besides `score` is refused; a stranger can't register without the code;
a manager can release and assign.

## Not in this version

Several umpires on one court, timeouts, match-of-3-games, score history beyond the match log line.
