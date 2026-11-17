# Monthly plan and 10-day trial

Date: 2026-11-17. Replaces the Free / Pro table and "How we take the money at first" in Phase 2 of
`docs/business/2026-10-16-earning-plan.md` (update that doc when this ships).

## Why

The owner wants CourtWave to earn from hosts without charging players: the standard app stays free forever, the extra
host tools are a monthly plan per club, and a new host gets 10 days to try those tools before deciding.

## Decisions (owner)

- **Free forever:** queue (all modes), booking page and waitlist, payment tracking and receipts, the Call button with the
  built-in voice, **managers** (moved to free on 2026-11-17).
- **Monthly plan, per club:** Live Board, volunteer umpires, player self check-in, recording your own voice, Excel export,
  club colors, unlimited open play (free: 4 a month).
- **Trial:** 10 days, once per **person**, starting when that person **creates their first club**. While it runs, every
  club the person owns gets the monthly features. A second club never restarts it.
- **Day 11 without paying:** nothing is deleted (settings, colors, recordings, members stay); the monthly features stop and
  say so; the owner sees reminders 3 days and 1 day before the end.
- **Clubs that exist at launch:** 3 months of the monthly plan free, as a thank-you.
- **Payment:** manual GCash. The host pays the owner; an admin marks the club paid until a date. No payment provider yet.
- **Admins:** `admins/{uid}` docs created by hand in the Firebase console. The owner picks the account; more admins later
  need no code change.

## Approaches considered

- **A. Manual GCash + admin-set dates, locked in `firestore.rules` (picked).** Needs nothing new (no Blaze, no business
  registration first). Cost: the admin renews each club by hand.
- **B. Automatic billing through PayMongo / Xendit.** Self-serve renewals, but needs Cloud Functions (Blaze), a registered
  business and provider approval before any money moves. Can be added on top of A later: it would only write the same
  paid-until date.
- Dropped: hiding the buttons in the app only. Anyone can call Firestore directly, so it doesn't protect anything.

## Goals / non-goals / anti-goals

- Goal: a free club cannot use a monthly feature even by calling Firestore directly, wherever the rules can see it
  (rules tests prove each lock).
- Goal: the trial can't be restarted or extended by the user.
- Non-goals: automatic billing, invoices, refunds, coupons, yearly price, plan for players.
- Anti-goals: anything that loses a club's data or setup when the plan ends; anything that blocks a player from booking
  or playing because of the host's plan; locking a game that is already in progress mid-night in a way that breaks the
  queue (the queue itself is always free).

## Data

- `admins/{uid}`: exists = admin. Read by its own uid only; no client writes (console only).
- `trials/{uid}`: `{ start, until }` (timestamps, `until = start + 10 days`). Created by the person's client **in the same
  batch as their first club** (`newClubDoc` path in `useClubActions`). Rules: create only if it doesn't exist, only for
  your own uid, `start == request.time`, `until == start + duration.value(10, 'd')`; no update, no delete by the client.
  The club create rule requires `existsAfter(trials/{ownerId})`, so every club owner has one.
- `clubs/{id}/billing/plan`: `{ paidUntil, note, updatedAt, updatedBy }`. Read by the club's managers; written by admins
  only. A missing doc = never paid.
- `config/billing`: `{ price, gcashName, gcashNumber, contact }` (price starts at **₱299 a month**, changed anytime on the admin page; screens always read it, never hard-code it), readable by any signed-in account, written by admins.
  Shown on the upgrade screen.

**Plan active** (rules function `planActive(clubId)`, same logic in `utils/plan.js` for the app):
`billing/plan.paidUntil + 3 days grace > request.time` **or** `trials/{club.ownerId}.until > request.time`.
The 3-day grace applies to paid periods only (the admin may renew a day late); the trial has none.

## Locks

| Feature | Where it's locked |
|---|---|
| Live Board (club games) | `eventViewer` requires `planActive`; writing `private/live` requires it. Old links stop on day 11. |
| Volunteer umpires | `eventUmpire` and the `umpires` / `courtClaims` creates require it; writing `private/umpire` requires it. |
| Self check-in | `eventCheckin` and the `checkins` create require it; writing `private/checkin` requires it. |
| Own voice | writing `clubs/{c}/voice/*` requires it; reading stays (the app plays clips only while active, else built-in voice). |
| Club colors | **changing** `club.display.accent / team1 / team2` requires it (other `display` fields stay free). Colors already saved keep showing after the plan ends (owner, 2026-11-17). |
| Open play limit | see below. |
| Excel export | app only: the data is already readable by managers, so rules can't stop a CSV. Shows the upgrade note. |

Managers' writes to `events/{e}/private/*` currently go through the `{sub}/{docId}` manager wildcard; the builder must
make sure the wildcard can't be used to bypass these locks.

**Open play limit (4 a month on free):** rules can't count, so a counter `clubs/{c}/usage/{YYYY-MM}` = `{ n }` is
written in the same batch as a new **bookable** event (not walk-ins / Play now, which stay unlimited). The event create
rule checks with `getAfter` that `n` went up by exactly 1 and, unless `planActive`, that `n <= 4`. Deleting an event
doesn't give the slot back. The month is the **UTC month of `request.time`** (rules can't do time zones, and a
client-chosen month could dodge the limit); the rules check the counter's id against it. (Builder's call, from review.)

**Who sees the plan state (builder's call, from review):** the club doc carries `trialUntil`, copied from the owner's
trial when the club is created (rules check it equals `trials/{ownerId}.until`), so managers and the app can show it
without reading the trial doc. The anonymous Live Board, umpire and check-in pages treat a refused read as "this club's
monthly plan isn't active" instead of reading billing.

**A game in progress finishes (owner, 2026-11-17):** Proceed to game, Play now and Reopen game stamp `planGame: true` on
the event when `planActive` is true at that moment (rules: the stamp may only be set to true while active). The game locks
above (Live Board, umpires, check-in) accept `planActive(clubId) || event.planGame == true`, so a game started on the plan
keeps them until End game (and the Live Board its usual 12 hours after). Reopening a game after the plan ended clears the
stamp. Voice recording and colors are not per game and lock at the end as normal.

**Quick session (owner, 2026-11-17):** `/club` stays fully free, Live Board, umpires and voice included. No change to
`sessions/{uid}` rules. Known: a host can use it to avoid the plan; accepted.

## Screens

- **Locked feature:** in place of the action, a short card: what the feature does, "Part of the monthly plan", the
  price, and **Upgrade** (opens the upgrade window). Never just a disabled button.
- **Upgrade window:** price, GCash name and number from `config/billing`, "Send your receipt to {contact}; we'll switch
  your club on within a day."
- **Banners (owner and managers of the club, top of club screens and the game Dashboard):** trial "N days left of your
  free trial" from 3 days before; paid "Your plan ends on {date}" from 3 days before; after the end "Your trial has ended
  / Your plan has ended. Upgrade to keep Live Board, umpires…". Dismissible per day (localStorage).
- **Club Settings:** a **Plan** tab showing Free / Trial (ends {date}) / Monthly (until {date}) and Upgrade.
- **Live Board / umpire / check-in pages when locked:** "This club's monthly plan isn't active." (no data shown).
- **Admin page** `/admin` (route `admin`, shown in the account menu only to admins): search clubs by name, each with owner,
  trial end, paid until; **Add 1 month** (from the later of today or the current end), set a date, a note; edit
  `config/billing`. Admins may `list` clubs and `get` trials for this.
- **Landing page:** a Free / Monthly section and the "How much does it cost?" answer.

## Launch

- A one-off script (admin SDK, like `scripts/seed-help.mjs`) writes `billing/plan.paidUntil = launch + 90 days` for every
  existing club and `trials/{ownerId}` with an already-ended trial for every existing owner (so they can't take a fresh
  10 days on top). Run against production once, after the rules are published.
- Order: publish rules, run the script, deploy hosting.

## Builder's calls

- Rules function names, file layout of the admin page, banner styling (theme tokens, `clubs.css`).

## Open questions

None.
