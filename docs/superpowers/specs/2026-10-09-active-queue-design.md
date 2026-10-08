# Active queue on Home

When a person is waiting for a court in a live game at one of their clubs, Home shows it under the "Ready to play?" card:

```
Your active session
Arat Pickleball Club            (green dot) Queue is active
You're #4 in line · 3 players ahead · about 10 min
                                                    [ View queue ]
```

When nothing is active the section is not on the page. If the person is on a court, the same card says "You're on court 2" and still links to the queue.

## What is missing today

Game players (`clubs/{id}/events/{id}/players`) are names with no account link, and game data is readable by managers only. So the hub can't tell whose queue spot is whose.

## Design

**1. Link a player to an account (`uid` on the player doc).** Option A, chosen by the owner:
- **Bookings.** A signed-in person (a real account, not a quick-session or old club login) who sends an open-play request adds `uid: auth.uid` to the private request. The rules accept an optional `uid` only when it equals `request.auth.uid` and the user is a real account. It is never copied to the public attendee list. "Proceed to game" and "Add players to game" read the event's requests (the host already has them) and copy `uid` onto each new player whose `seatId` matches a request that has one.
- **Walk-ins.** The host's add-player form (`PlayerModal`) gets an optional "Club member" picker (members of this club). Choosing one fills the name and sets `uid`. Editing a player can set or clear it.

**2. Members can read the queue.** Rules: under an event, `players` and `courts` are readable by club members as well as managers (writes stay managers-only; `matchLog`, `costs`, `requests` unchanged). This lets a member see the names, games and wins of the people in a live game of a club they belong to. Skill level and gender are on those documents, so members of a club can see them too. This is the one privacy cost of the feature, and it matches the Live Board's existing "show skill" choice being a screen setting, not a data one.

**3. The hub listens.** For each of the person's clubs: one query on its events with `status == "live"` (single field, no index). For each live event: its `players` and `courts`. Nothing is listened to when the person has no clubs. A card shows only when the person has a player with their `uid` who is checked in.

**4. Pure rules, `utils/queueStatus.js`.** `queueStatus({ players, courts, uid, format, gameMinutes })` returns `null` (not in the game or not checked in), `{ state: "playing", court }`, or `{ state: "waiting", position, ahead, waitMins }`.
- The queue is the checked-in players who are not on a court, ordered like the queue app (fewest games, then earliest check-in).
- Seats per round = open courts' worth for "next", then (courts × 4 for doubles, 2 for singles) per round of games after that.
- `waitMins`: 0 and "You're up next" when a court is free and the person is within its seats; otherwise `(rounds − 0.5) × gameMinutes`, rounded to 5. `gameMinutes` is the club's game alert length when set, else 15.
- Limit, said on screen with "about": positions follow the default order. Winners/Losers, Custom and Mixed Doubles pick differently, so the position can change when the host picks by hand.

**5. View queue.** New read-only route `/clubs/:id/event/:eventId/queue`, members only. It shows the event title, the queue in order with games played, who is on each court, and highlights the person. No controls.

## Components

- `utils/queueStatus.js` + `queueStatus.check.mjs`.
- `hooks/useActiveQueues.js` (the listeners) and `components/ActiveQueue.jsx` (the card), used by `Hub.jsx`; the section hides itself with CSS (`:has`) when it has no card.
- `views/QueueView.jsx` and the `club-queue` route in `utils/route.js`.
- `OpenPlay.jsx` (add `uid` when signed in), `gameSession.js` (`playersToAdd` takes a seat-to-uid map), `PlayerModal` and `Game.jsx` (member picker, using `useMembers`).
- `firestore.rules`: optional `uid` on event requests; member read on `players` and `courts`. Tests in `tests/rules.test.mjs` / `membership.test.mjs`.

## Not included

Self check-in by QR (option B), notifications when your turn is close, linking players retroactively, per-mode position accuracy, and showing the card for a game you only watch.

## Tests

`queueStatus.check.mjs` (position, ahead, up next, playing, not checked in, singles, empty, ties); rules matrix (stranger, member, manager read of `players`/`courts`; `matchLog` and `costs` still closed to members; `uid` on a request only when it is your own); browser pass with a host and two members across a game.
