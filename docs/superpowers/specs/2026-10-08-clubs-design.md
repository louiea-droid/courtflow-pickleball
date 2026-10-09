# Clubs: create, join, manage, host open play

Date: 2026-10-08. Status: draft for owner review. Part A (clubs core) is specified in full; parts B and C are specified at the data and rules level so A's structures fit them, and each gets its own plan.

Builds on the accounts, events and game work on branch `feat/accounts-hub` (specs `2026-10-06-accounts-and-events-design.md` and `2026-10-07-event-game-design.md`).

## Goal

A signed-in person can create clubs and join other people's clubs. Each club has an owner, optional managers and members, its own settings and roster, and its own open play and games. The person's account is just their own profile.

Decided with the owner:
- **Joining:** a public directory with search, request to join with approval by an owner or manager, plus an invite link that joins right away.
- **Who manages:** the owner, plus managers the owner names.
- **Ownership:** clubs own events, games, roster and settings. Start fresh: nothing under `accounts/{uid}` is migrated. The account is only the player's profile.
- **Visibility:** each club is public or private. Public: listed in the directory, open play bookable by anyone with no sign-in (as today). Private: not listed, open play for signed-in members only.
- **Invite link:** joins right away (no approval). Resetting it stops old links.
- **Private club page:** shows its name and description to anyone signed in who has the club's address (the random club id), so an invite visitor can see what they are joining. Open play and the member list stay members-only.
- **Theme:** inside a club, the club's colors apply. The hub and profile keep the person's own light or dark choice.

## Build order (each part: spec, plan, tests, shippable)

- **A. Clubs core.** Create a club; club page; the club area (open play list, event page, game, settings) under `/clubs/:id`; the hub lists your clubs; profile page; the owner is the only member. Roles and membership records exist from day one so B and C slot in.
- **B. Membership.** Invite link, request to join and approval, the directory and search, the member list, leaving, removing members, private-club rules for members.
- **C. Managers.** The owner names and removes managers; manager permissions apply in rules and screens.
- Afterwards: the roster per club (step 3b, redesigned for clubs) and the per-event Live Board (step 4).

## Data model

| Path | Holds | Read | Write |
|---|---|---|---|
| `accounts/{uid}` | profile only: `name`, `email`, `createdAt`, `display.theme` (global light / dark / system preference) | owner | owner |
| `accounts/{uid}/memberships/{clubId}` | a display copy for "My clubs": `clubName`, `role`, `joinedAt` | owner | owner; a manager of that club may create it when approving (B) |
| `clubs/{clubId}` | `name`, `description`, `location`, `visibility` (`public` / `private`), `ownerId`, `createdAt`, and the club's settings: `defaults`, `rules`, `costDefaults`, `live`, `display` (time zone, clock, accent, team colors) | public clubs: anyone; any club: any signed-in user by id (`get`); list only public clubs | managers (some fields owner-only, see below) |
| `clubs/{clubId}/members/{uid}` | `role` (`owner` / `manager` / `member`), `name`, `joinedAt` | members | see Rules |
| `clubs/{clubId}/joinRequests/{uid}` (B) | `name`, `message`, `status`, `createdAt` | the requester and managers | the requester creates; managers update and delete |
| `clubs/{clubId}/private/invite` (B) | `code` | managers | managers |
| `clubs/{clubId}/events/{eventId}` + `players`, `courts`, `matchLog`, `costs`, `requests` | exactly today's event data, moved | see Rules | managers (requests: see Rules) |
| `clubs/{clubId}/roster/{id}` (later) | roster entries | members | managers |

Notes:
- The membership copy exists so "My clubs" loads without a database index. The record that grants access is always the club's own `members/{uid}`.
- The club id is a random Firestore id. The event, game, cost and request shapes do not change.
- Existing data under `accounts/{uid}/events` and `roster` is left alone and unreachable. Account delete still clears those legacy collections so nothing is left behind.

## Roles

| | Member | Manager | Owner |
|---|---|---|---|
| See the club, its open play, and book | yes | yes | yes |
| Create, edit and delete open play; run games | no | yes | yes |
| Approve or decline requests, remove members, reset the invite link | no | yes, not other managers | yes |
| Edit name, description, location, settings | no | yes | yes |
| Change public / private, name or remove managers, delete the club | no | no | yes |
| Leave the club | yes | yes | no (delete the club instead; transfer is out of scope) |

## Rules (Firestore)

Helpers, written so B and C need no restructuring:

```
isRealUser()      signed in, not anonymous, not a legacy @courtflow.local login
member(clubId)    /clubs/{clubId}/members/{auth.uid}
isMember(clubId)  isRealUser() && exists(member(clubId))
isManager(clubId) isMember(clubId) && get(member).role in ['owner','manager']
isOwner(clubId)   isMember(clubId) && get(member).role == 'owner'
```

- **Club doc:** `create` by a real user with `ownerId == auth.uid` and validated fields (name 1 to 60 characters, `visibility` in the two values). `get` by any signed-in user; `list` only for documents with `visibility == 'public'`. `update` by managers on content and settings fields, by the owner on `visibility` and `ownerId` stays fixed. `delete` by the owner.
- **Members:** the owner's own record may be created in the same batch as the club (`getAfter(club).ownerId == auth.uid`, `role == 'owner'`). In part A nothing else is created. `read` by members. In B a user may delete their own record (leave) unless owner; invite joins create `role == 'member'` records carrying the invite code; managers remove plain members. In C only the owner changes `role`.
- **Events:** `read` by anyone when the club is public, by members when private. `write` by managers. `requests`: a validated pending `create` by anyone for a public club's existing event (today's rule, unchanged shape); for a private club by members only; `get` of a single request by id; `list`, `update`, `delete` by managers. **Game data under an event** (`players`, `courts`, `matchLog`, `costs`) is managers-only, as decided in step 3a; read access opens when the Live Board needs it.
- **Roster and `private/invite`:** members read the roster (roster later); managers write. The invite document is managers only.
- **Memberships copy:** `accounts/{uid}/memberships/**` owner only in A.
- **Legacy:** `accounts/{uid}/events/**` and `roster` rules are removed from the rules file; account delete clears them through the owner's `accounts/{uid}/{document=**}` access, which stays.
- Cost: `get`/`exists` on the member record on each club write. Accepted at this scale.

Every rule above gets an emulator test for a stranger, a signed-out visitor, a member, a manager and the owner, on both a public and a private club.

## Part A in detail

### Screens and routes

`routeOf` gains the club routes, and the quick session's route name changes from `club` to `quick` (its URL `/club` is unchanged).

| URL | Screen |
|---|---|
| `/` | Hub: **My clubs** (name, your role, tap to open), **Create a club**, the **Quick session** card. (Find clubs comes in B.) |
| `/clubs` | Redirects to `/` in A (the directory arrives in B). |
| `/clubs/new` | Create a club: name, description, location, public or private, then create. The creator becomes owner and lands on the club page. |
| `/clubs/:id` | Club page. Everyone signed in sees name, description, location, and (when allowed) upcoming open play. Managers also see links: **Open play**, **Settings**. |
| `/clubs/:id/host` | Today's `/host`: open play list, New open play, Play now, Share booking page. |
| `/clubs/:id/event/:eventId`, `/clubs/:id/event/:eventId/game` | Today's event page and game, moved. |
| `/clubs/:id/settings` | Club settings (today's account settings page): club name and description, public or private (owner), session defaults, queue rules, cost defaults, Live Board, display and theme, and a Danger zone with **Delete club** (owner). |
| `/settings` | Profile: name, email, change password, personal theme, delete account. |
| `/open-play?club={clubId}` | The public booking page; `?host=` is replaced. Private clubs show "This club's open play is for members" with a sign-in prompt. |

A club shell wraps the `/clubs/:id/...` screens: a header with the club name and role, links Overview, Open play, Settings, and "Back to my clubs". The shell loads the club doc and the person's member record; a person with no record sees the club page without the management links, or "Club not found" when the club cannot be read. The club's theme and time zone apply inside the shell and on the public page.

### Code changes (mostly mechanical)

- `utils/paths.js`: `eventBase(clubId, eventId)` returns `["clubs", clubId, "events", eventId]`. `sessionBase` is unchanged.
- Hooks take a `clubId` where they took the account `uid`: `useEvents`, `useEventRequests`, `useEventPlayers`, `useEventActions`, `useGameActions`.
- New: `useClub(clubId)` (club doc plus the person's member record plus derived `role`, `canManage`, `isOwner`), `useMyClubs(uid)` (the memberships copy), `useClubActions` (create, update settings, delete).
- `useAccount` shrinks to the profile. Club settings merge (`DEFAULT_RULES`, and so on) moves to the club.
- `AccountApp` is split into the hub and profile shell and a `ClubApp` shell for `/clubs/:id/...`. `Game.jsx`, `buildGameSession(club, event)` and `GamePickModal` receive the club instead of the account. `OpenPlay.jsx` reads `?club=`.
- `Settings.jsx` mode `account` becomes mode `club` (club rows plus Delete club); account rows move to a new small `Profile.jsx`. The legacy "club login" mode and its rows are removed.
- Delete cascade: `deleteClubData(db, clubId)` removes events with all subcollections, members, join requests, the invite document, the roster, then the club doc; and the owner's membership copy. `deleteAccountData` deletes each club the account owns (the confirmation lists them), removes memberships, and clears the legacy collections.

### Create club

One batch: the club doc (with defaults for settings), the owner's member record, the owner's membership copy. If the batch fails nothing is created.

### Testing (part A)

- `node` checks: new `route.check.mjs` cases for the club routes and the renamed quick route; a new pure helper check for role permissions (`canManage`, `isOwner`) and for building a membership copy; `paths.check.mjs` for the club event base; `gameSession.check.mjs` updated for a club argument.
- Emulator: the full rules matrix above (for A's reachable cases: owner, stranger, signed-out, anonymous-quick user, and seeded manager and member records to pin the rules B and C will use), the cascade test for club delete and account delete.
- Browser: create a club (public and private), land on its page, create open play, run a game end to end, edit club settings, delete the club, create a second club and confirm the two are separate, delete the account with an owned club.

## Parts B and C in outline

- **B:** Directory (`/clubs/find`): searches public clubs by name or place (loaded once, filtered on the device; `nameLower` stays on the club doc for a later server-side search). Club page shows **Request to join** (creates `joinRequests/{uid}`); the owner and managers see **Requests** with Approve (creates `members/{uid}` as `member` and the person's membership copy) and Decline. **Invite link** `/clubs/:id?invite=CODE`: signed in, the visitor taps **Join**, which creates their member record carrying the code; the rule compares it to `private/invite`. Members list with Remove, **Leave club**, **Reset invite link**. Private-club behavior for members.
- **C:** Members list gets **Make manager / Remove manager** (owner only); rules and screens use `isManager` everywhere; manager limits from the roles table are enforced in rules.

## Risks

- **Moving the data model** touches every hook and route. Mitigation: mechanical `uid` to `clubId` replacement, the same rule tests rewritten for clubs, and a full browser run of the game flow before part A is called done.
- **Rules cost and complexity** (`get` on member records). Mitigation: helper functions, a test matrix, and keeping the member record the single source of truth.
- **Public booking for public clubs stays unauthenticated**, so phone numbers and request ids keep today's protections (create-only with validated fields, no list).
- **Old test data** under accounts becomes unreachable. Accepted (start fresh); account delete clears it.
- **Console actions:** publishing `firestore.rules` is still the owner's step; part B's directory search needs no index: it loads up to 200 public clubs and filters them on the device (see the part B spec).
