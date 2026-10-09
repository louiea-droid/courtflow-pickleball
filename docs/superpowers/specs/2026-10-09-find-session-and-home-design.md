# Find session and the new Home

**Goal.** A person can find open-play sessions and bookings from any public club, joined or not, and Home shows the session they are in right now and what is coming up, on cards that read at a glance.

## What the owner asked for

- "Find a club" on Home becomes **Find session**: it finds open play sessions and bookings from other clubs even when the person has not joined that club.
- Below it, re-layout and redesign the cards; show the **current active session** the person is in; and show **other sessions for different dates**.

(Assumptions, open to correction: the club directory stays reachable as "Find a club" in the sidebar and from Find session; joining a session uses the existing event page and booking flow, unchanged.)

## Data: one query across every public club

Events live at `clubs/{clubId}/events/{eventId}`. A query across all clubs is a collection-group query on `events`. Rules cannot look up a club from inside a query, so each event carries `clubPublic` (boolean, the club's visibility copied on, like `hostName` and `timeZone` already are) and `clubId` / `clubName` (so a card can name and link its club without more reads).

- **Rule:** `match /{path=**}/events/{eventId}` allows `read` when `resource.data.clubPublic == true`. Nothing else is opened; private club events stay members-only through the existing rule.
- **Query:** `collectionGroup("events")`, `where("clubPublic", "==", true)`, `where("date", ">=", today)`, `orderBy("date")`, `limit(100)`. Walk-ins, ended and past-time events are dropped on the device with the existing `isListed`. Needs one composite collection-group index (`clubPublic` asc, `date` asc) in `firestore.indexes.json`; it must be deployed (`firebase deploy --only firestore:indexes`), as with the rules.
- **Keeping the copy true (no separate migration).** `useEventActions.save` writes `clubPublic`, `clubId`, `clubName` on create and update. A small effect in `ClubApp` (managers only) compares every loaded event with the club (`visibility`, `name`) and writes the difference in a batch. That one effect backfills old events, and re-syncs everything when the owner flips public/private or renames the club, because the owner is on that page when they do. A manager who never opens the club leaves stale copies only until someone does.
- Pure helper and check: `utils/sessions.js` (`sessionMeta(club)` for the copied fields, `needsSync(event, club)`, `groupByDate(events, today)`, `filterSessions(events, text, date)`; check: `node src/utils/sessions.check.mjs`).

## Find session (`/sessions`, route `sessions`)

- Title "Find session", sub "Open play and bookings from clubs near you, joined or not."
- A date strip: Any day, Today, Tomorrow, then the next days that have sessions (up to 7 chips). A search box filters by club, title or place on the device.
- Session cards grouped under a date heading ("Today, Fri Oct 9"): time and length, title, club name, spots left or "Full, waitlist open", fee, level. A card is a link to `/clubs/{clubId}/event/{eventId}` (public clubs show it to anyone signed in, where the person can book). A badge "Your club" when they are a member.
- Empty states say what to do ("No sessions on this day. Try another day or Any day.").
- Sidebar: "Find session" replaces the first Play entry; "Find a club" stays a second entry and a link on the page.

## Home

1. **Ready to play?** bar: **Find session** (primary), **Quick session** (outline).
2. **Your active session**: the live-queue card when the person is a checked-in player (existing `ActiveQueue`), otherwise one calm empty card: "You're not in a session. Find one to join." with a Find session link. (Replaces hiding the section.)
3. **Coming up**: the next sessions by date (same query and cards as Find session, five at most, my clubs' first within a day), "See all sessions" to `/sessions`.
4. **Your clubs** as a compact list (name, role pill), "Create a club" as a text action; **Friends** and **Inbox** as one slim row with their counts and badges. The existing card styling is kept; tokens only, no raw colours; new CSS in `clubs.css`.

## Out of scope

Distance or map search (clubs have a free-text place only), notifications for new sessions, saving or "interested" marks, searching private clubs' sessions.

## Review focus

1. A private club's events never appear in the query or Find session, including right after its owner switches it from public to private.
2. The new collection-group rule exposes only events flagged `clubPublic == true`, only for reading.
3. Events created before this change appear once a manager opens their club (the sync effect), not before.
4. Past, ended and walk-in sessions are not listed; a live session of a public club is shown as live.
5. The Home empty states (no clubs, no sessions, no active session) read sensibly and nothing jumps while loading.
