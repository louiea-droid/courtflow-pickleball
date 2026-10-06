# Accounts and open-play events: design

Date: 2026-10-06. Status: draft for owner review.

## Goal

A host signs in with a real account, picks what to do from a hub, and runs open plays end to end:
create an event, take bookings and payments, then on the day tap "Proceed to game" to run the
existing queue for that event. Each event keeps its own games, costs and history.

Decided with the owner:
- One roster per account, remembered across events.
- A "Play now" button creates an unscheduled event for today (no booking or payment needed).
- Start fresh: existing clubs and data are not migrated. Old `sessions/*` data stays in Firestore, unused.
- Sign-in: email + password and Google (Firebase Auth), which also gives password reset.

Out of scope here: the public landing page for the whole site (step 4 follow-up), friendly club slugs for
links, push/SMS reminders, real online payments (PayMongo/GCash), recurring events, multiple staff per account.

## Approach

Everything nests under the account: `accounts/{uid}/...`. Rules become "the `uid` in the path equals the
signed-in user", with no document lookups. Rejected: top-level events with an `ownerUid` field (every rule
must read the parent), and layering events on today's `sessions` (keeps the one-club-one-endless-session model).
Trade-off accepted: public links carry the host's uid until the landing page adds readable slugs.

## Data model

| Path | Holds | Read | Write |
|---|---|---|---|
| `accounts/{uid}` | profile, club name, club-wide settings: `display` (theme, time zone, 12/24h), `rules`, `costDefaults`, `live`, `defaults`, `payInfo` | owner | owner |
| `accounts/{uid}/roster/{playerId}` | name, skill, gender, lock partner | owner only | owner |
| `accounts/{uid}/events/{eventId}` | `title`, `date`, `startTime`, `durationMins`, `maxPlayers`, `fee`, `level`, `notes`, `payInfo`, `attendees[]`, `status` (`scheduled` / `live` / `ended`), `courts`, `format`, `mode`, `autoRotate`, `startedAt`, `endedAt` | public | owner |
| `.../events/{eventId}/players/{playerId}` | that event's participant: copy of roster name/skill plus `checked`, `checkedAt`, `games`, `wins`, `losses`, `partners`, `lastResult` (doc id = roster id) | public | owner |
| `.../events/{eventId}/courts`, `matchLog`, `costs` | as today | public | owner |
| `.../events/{eventId}/requests/{requestId}` | player join request (name, contact, method, ref, status) | owner lists; anyone gets one by id | public create (validated, pending only); owner update/delete |

Notes:
- The queue code keeps its shape. It receives `session = { ...account settings, ...event }` and reads the
  event's subcollections instead of the club's. Settings stay one place (the account); an event can override later.
- Booking attendees and seat/waitlist logic (`utils/bookings.js`) move over unchanged. An attendee's `playerId`
  now points at the roster.
- "Check in to the queue" copies roster entries into the event's `players` (adding new roster entries for walk-ins) and
  writes the Cost entry as it does now.
- Lifetime stats per player are derived later from ended events; not stored in v1.

## Screens and routes

Minimal hand-rolled route hook on `location.pathname` plus `popstate`; no router library.

| Route | Screen |
|---|---|
| `/` | Hub: cards for Host open play, Players (roster), Settings. Signed out: sign-in / create account / Google / reset password. |
| `/host` | Events list (upcoming, past), New open play, Play now. Today's `views/Bookings.jsx` list and cards. |
| `/event/:id` | Event page: attendees, payments, join requests, share link/QR, "Proceed to game" (shown when scheduled or live). |
| `/event/:id/game` | Today's Dashboard / Queue / Cost / Stats shell scoped to the event. "End Session" becomes "End game": archive stats, set `ended`, return to the event page. "New Session" is removed. |
| `/players` | Roster (today's Players view at account level). |
| `/settings` | Account settings (today's Settings page, minus session-specific items). |

Public routes, no sign-in:
- `/open-play?host={uid}`: upcoming events for that host; join by request, status shown on the player's device (as built now).
- `/live?host={uid}&event={eventId}`: Live Board for one event; honours the account's Live Board settings (on/off, key, what to show).

## Security rules

- Under `accounts/{uid}/**`: read and write only when `request.auth.uid == uid`.
- Exceptions: `events/**` is publicly readable (Live Board, public page), except `requests`, which only the owner can list;
  `requests/{id}` allows public `get` and a validated, pending-only public `create` (same field checks as today's rules).
- `roster` is never public (tighter than today's all-readable clubs).
- Verified with the Firestore emulator, extending the existing script: anonymous, owner, and other-account cases.

## Account lifecycle

- First sign-in creates `accounts/{uid}` with defaults. Google and email accounts with the same email are linked by Firebase.
- Delete account: re-authenticate, delete roster and every event with its subcollections in chunked batches
  (batches cap at 500 writes), then the Auth user. Data first, account last (as today).
- Old fake-email club accounts and `sessions/*` are ignored. Purging them is a separate cleanup.

## Build order (each step shippable and tested)

1. Accounts and sign-in, hub, account doc and account-level settings. Rules for `accounts/**`.
2. Events: host list, create/edit, attendees, payments, requests, moved onto `events`. Play now.
3. Roster; "Proceed to game" opening the existing queue scoped to the event; "End game" archives to the event.
4. Per-event public pages and Live Board links; then the landing page (separate spec).

Each step gets a written plan and its own check (rules emulator tests plus the existing `*.check.mjs` scripts).

## Risks

- Rules rewrite: mistakes expose or lock data. Mitigation: emulator tests per step before deploy.
- `App.jsx` hard-codes `sessions/{club}` paths in many places. Mitigation: one `eventRef` helper, then mechanical replacement.
- Public links expose the host uid until slugs exist. Accepted; uids are not secret.
- Roster privacy changes how the Live Board gets names: it reads names from the event's `players` copy, never the roster.
