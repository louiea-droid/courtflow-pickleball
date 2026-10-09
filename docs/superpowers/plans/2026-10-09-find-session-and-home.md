# Find Session and the New Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Home gets "Find session" (open play and bookings from any public club, joined or not), an always-visible "Your active session" card, a "Coming up" list by date and a calmer layout; `/sessions` is the full finder.

**Architecture:** Every event carries a copy of its club (`clubPublic`, `clubId`, `clubName`, `clubLocation`). A collection-group query on `events` filtered by `clubPublic == true` and `date >= …` feeds both Find session and Home's "Coming up". A manager-only effect in `ClubApp` keeps the copies true (backfill, rename, public/private flip). Pure logic is in `utils/sessions.js`.

**Tech Stack:** React 19, Firebase Firestore (collection-group query + one composite index), node `*.check.mjs` checks, rules tests (`npm run test:rules`, emulator).

**Spec:** `docs/superpowers/specs/2026-10-09-find-session-and-home-design.md`

## Global Constraints

- Colors are tokens (`var(--…)`), never raw hex; new CSS only in `src/clubs.css`; sentence case; no avatar-initial badges next to names; lucide icons only, no emoji.
- Real accounts only for the page (it lives in `AccountApp`); the collection-group read rule needs no sign-in beyond what events already need (`resource.data.clubPublic == true`), read only.
- Neutral buttons/links are `.outline`; `.primary` once per screen region. Any new horizontal `nav` sets `flex-direction:row`.
- Commit only your own hunks: the tree holds someone else's uncommitted theme edits (`AccountApp.jsx`, `ClubApp.jsx`, `clubs.css`, ...). For those files stage `HEAD` + your edit with `node $TEMP/stage-mine.cjs <edits.json>` (pairs for HEAD content, `append` for CSS), then build the index tree (`git checkout-index -a --prefix=$TEMP/headtree/`, junction `node_modules`, `npx vite build`) before committing.
- Stop dev emulators (ports 8080/9099) before `npm run test:rules`.

## Review Focus

1. A private club's events never appear in the query or on screen, including right after the owner switches the club public → private (the sync effect must flip `clubPublic` to false).
2. The new rule exposes only events flagged `clubPublic == true`, read only: a query without that filter, an unflagged event and a private event are refused; nobody can write through it.
3. Events created before this change (no flag) appear only after a manager opens their club; `needsSync` must treat a missing flag as "differs".
4. Past, ended and walk-in sessions aren't listed; a live session shows as live; an event in another time zone is judged in its own zone.
5. Home: no clubs, no sessions, no active session each read sensibly; nothing flashes "no sessions" while the query is still loading.

---

### Task 1: Pure helpers (`utils/sessions.js`)

**Files:**
- Create: `src/utils/sessions.js`, `src/utils/sessions.check.mjs`

**Interfaces (produces):**
- `sessionMeta(clubId, club)` → `{ clubPublic: boolean, clubId, clubName, clubLocation }` (`clubLocation` is `club.location || ""`).
- `needsSync(event, meta)` → true when any of the four fields differs (a missing field differs).
- `queryFromDate(now = new Date())` → `YYYY-MM-DD` of the previous UTC day (the query lower bound, so no zone is cut off; exact filtering is `isListed`).
- `listedSessions(events, now)` → the events that are `isListed` in their own zone (`event.timeZone || "Asia/Manila"`), with `byStart` order.
- `spotsLabel(event)` → `"Open"` when no `maxPlayers`; `"Full, waitlist open"`; `"1 spot left"`; `"N spots left"` (confirmed = `splitAttendees(event).confirmed.length`).
- `groupByDate(events)` → `[{ date, events }]` in date order (events already sorted).
- `dateChips(events, today)` → `["any", today, tomorrow, ...up to 5 more dates that have sessions]` with no repeats, in order; `today` / `tomorrow` are always present.
- `filterSessions(events, text, date)` → events whose `date === date` (when `date !== "any"`) and whose club name, location, title or level contains the text (case-insensitive, trimmed).
- `dayHeading(date, today)` → `"Today"` / `"Tomorrow"` / `formatDay(date)` (import from `format.js`).

- [ ] **Step 1: Failing check** (`node src/utils/sessions.check.mjs`):

```js
import assert from "node:assert/strict";
import { dateChips, dayHeading, filterSessions, groupByDate, listedSessions, needsSync, queryFromDate, sessionMeta, spotsLabel } from "./sessions.js";

const club = { name: "Ace Club", visibility: "public", location: "Manila" };
assert.deepEqual(sessionMeta("c1", club), { clubPublic: true, clubId: "c1", clubName: "Ace Club", clubLocation: "Manila" });
assert.equal(sessionMeta("c1", { name: "X", visibility: "private" }).clubPublic, false);
assert.equal(sessionMeta("c1", { name: "X", visibility: "private" }).clubLocation, "");

const meta = sessionMeta("c1", club);
assert.equal(needsSync({ ...meta }, meta), false);
assert.equal(needsSync({}, meta), true); // an old event with no copy
assert.equal(needsSync({ ...meta, clubPublic: false }, meta), true); // the club went public
assert.equal(needsSync({ ...meta, clubName: "Old" }, meta), true); // renamed
assert.equal(needsSync({ ...meta, clubLocation: "" }, meta), true);

assert.equal(queryFromDate(new Date("2026-10-09T03:00:00Z")), "2026-10-08");

const ev = (id, date, startTime, extra = {}) => ({ id, date, startTime, durationMins: 60, maxPlayers: 4, attendees: [], timeZone: "UTC", ...extra });
const now = new Date("2026-10-09T10:30:00Z");
const listed = listedSessions([
  ev("past", "2026-10-09", "08:00"), ev("later", "2026-10-09", "15:00"), ev("tomorrow", "2026-10-10", "09:00"),
  ev("walk", "2026-10-09", "16:00", { walkIn: true }), ev("ended", "2026-10-11", "09:00", { status: "ended" }),
  ev("live", "2026-10-09", "09:00", { status: "live" }), // started earlier but still live: listed
], now);
assert.deepEqual(listed.map((e) => e.id), ["live", "later", "tomorrow"]);
assert.equal(listedSessions([ev("tz", "2026-10-09", "09:00", { timeZone: "Asia/Manila" })], now).length, 0); // 17:30 in Manila: over

assert.equal(spotsLabel({ maxPlayers: 0, attendees: [] }), "Open");
assert.equal(spotsLabel(ev("a", "d", "t", { attendees: [{}, {}, {}, {}] })), "Full, waitlist open");
assert.equal(spotsLabel(ev("a", "d", "t", { attendees: [{}, {}, {}] })), "1 spot left");
assert.equal(spotsLabel(ev("a", "d", "t", { attendees: [{}] })), "3 spots left");

assert.deepEqual(groupByDate(listed).map((g) => [g.date, g.events.length]), [["2026-10-09", 2], ["2026-10-10", 1]]);
assert.deepEqual(dateChips(listed, "2026-10-09"), ["any", "2026-10-09", "2026-10-10"]);
assert.deepEqual(dateChips([], "2026-10-31"), ["any", "2026-10-31", "2026-11-01"]); // today and tomorrow always
const many = ["12", "13", "14", "15", "16", "17"].map((d, i) => ev(`m${i}`, `2026-10-${d}`, "09:00"));
assert.equal(dateChips(many, "2026-10-09").length, 8); // any, today, tomorrow, and at most 5 more

const named = [{ ...ev("1", "2026-10-09", "15:00", { title: "Friday mixer" }), ...meta }, { ...ev("2", "2026-10-10", "09:00", { title: "Drills", level: "Beginner" }), ...meta, clubName: "Zed", clubLocation: "Cebu" }];
assert.deepEqual(filterSessions(named, "", "any").map((e) => e.id), ["1", "2"]);
assert.deepEqual(filterSessions(named, " MIXER ", "any").map((e) => e.id), ["1"]);
assert.deepEqual(filterSessions(named, "cebu", "any").map((e) => e.id), ["2"]);
assert.deepEqual(filterSessions(named, "beginner", "any").map((e) => e.id), ["2"]);
assert.deepEqual(filterSessions(named, "", "2026-10-10").map((e) => e.id), ["2"]);
assert.equal(dayHeading("2026-10-09", "2026-10-09"), "Today");
assert.equal(dayHeading("2026-10-10", "2026-10-09"), "Tomorrow");
assert.match(dayHeading("2026-10-12", "2026-10-09"), /Oct 12/);
console.log("sessions.check: ok");
```

- [ ] **Step 2: Run it.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/utils/sessions.js` to the interface (reuse `splitAttendees`, `byStart`, `hasEndedIn` / `isListed` from `bookings.js`; `isListed(event, fallbackZone)` takes the fallback zone and uses `nowIn(event.timeZone || fallbackZone)` internally via `hasEndedIn`; to test with a fixed `now`, build the check from `hasEnded(event, { date, hm })` computed with `Intl` for the event's zone at `now` — if `bookings.js` has no injectable clock, add an optional third parameter `now = new Date()` to `nowIn(timeZone, now)` and thread it through `hasEndedIn`/`isListed` as optional args; existing callers stay unchanged).
- [ ] **Step 4: Run again.** Expected: `sessions.check: ok`; also run `node src/utils/bookings.check.mjs` (unchanged callers still pass).
- [ ] **Step 5: Commit.**

---

### Task 2: Rule, index and their tests

**Files:**
- Modify: `firestore.rules`, `firestore.indexes.json`, `package.json` (`test:rules` also runs `tests/sessions.test.mjs`)
- Create: `tests/sessions.test.mjs`

- [ ] **Step 1: Write the failing test** (same setup as `tests/chat.test.mjs`): seed `clubs/pub` (public) and `clubs/priv` (private) each with an event `e1`; give `pub/e1` `{ clubPublic: true, date: "2026-10-10", ... }`, `priv/e1` `{ clubPublic: false, ... }`, `pub/e2` with no `clubPublic` (an old event). Assert:
  - `getDocs(query(collectionGroup(db, "events"), where("clubPublic", "==", true), where("date", ">=", "2026-10-01")))` succeeds for a real person, anonymous, quick and legacy (it is public data, like the public booking page) and returns only `pub/e1`.
  - The same without the `clubPublic` filter fails; `where("clubPublic", "==", false)` fails; a single `getDoc` of `priv/e1` by a stranger still fails; a stranger cannot `setDoc`/`updateDoc` through any path.
- [ ] **Step 2: Run** `firebase emulators:exec --only firestore --project rules-test "node tests/sessions.test.mjs"`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `firestore.rules`, beside the other top-level matches (Firestore allows a collection-group rule next to the nested ones):

```
    // ---- Find session: events of public clubs can be listed across all clubs (collection-group query). Rules can't look a
    // club up inside a query, so each event carries a copy of its club's visibility (clubPublic); the query must ask for it.
    // Read only; writes stay with the club's managers through the nested rule.
    match /{path=**}/events/{eventId} {
      allow read: if resource.data.clubPublic == true;
    }
```

  and `firestore.indexes.json`:

```json
{
  "indexes": [
    { "collectionGroup": "events", "queryScope": "COLLECTION_GROUP", "fields": [
      { "fieldPath": "clubPublic", "order": "ASCENDING" },
      { "fieldPath": "date", "order": "ASCENDING" }
    ] }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 4: Run** `npm run test:rules`. Expected: all suites pass. (The emulator needs no index; the live project needs `firebase deploy --only firestore:indexes`, plus the rules republished.)
- [ ] **Step 5: Commit.**

---

### Task 3: Writing and keeping the copies true

**Files:**
- Create: `src/hooks/useSessionSync.js`
- Modify: `src/hooks/useEventActions.js`, `src/ClubApp.jsx` (HEAD-blob staging)

**Interfaces:**
- Consumes: `sessionMeta`, `needsSync` (Task 1).
- Produces: `useSessionSync({ clubId, club, events, canManage })`: when `canManage`, `club` and `events` are loaded and any event `needsSync`, writes the meta onto those events in one `writeBatch` (chunks of 400); runs again whenever `club.visibility` / `name` / `location` or the event list changes; never loops (a second pass finds nothing to do).

- [ ] **Step 1:** `useEventActions({ clubId, club, ... })` takes the club document; `save` spreads `sessionMeta(clubId, club)` into both the create and the update. (`ClubApp` already has `club`; pass it.) `game`-created events (`useGameActions` play-now / walk-in) also spread it: find where it creates an event doc and add the same spread; walk-ins are never listed but must not look "stale" forever.
- [ ] **Step 2:** `useSessionSync` as above:

```js
import { useEffect } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { needsSync, sessionMeta } from "../utils/sessions";

// Managers' pages repair the club copy on events (old events, a rename, public <-> private) so Find session is true.
export function useSessionSync({ clubId, club, events, canManage }) {
  const key = club ? `${club.visibility}|${club.name}|${club.location || ""}` : "";
  useEffect(() => {
    if (!canManage || !club || !events.length) return;
    const meta = sessionMeta(clubId, club);
    const stale = events.filter((e) => needsSync(e, meta));
    if (!stale.length) return;
    (async () => {
      for (let i = 0; i < stale.length; i += 400) {
        const batch = writeBatch(db);
        stale.slice(i, i + 400).forEach((e) => batch.update(doc(db, "clubs", clubId, "events", e.id), meta));
        await batch.commit();
      }
    })().catch(() => {}); // ponytail: a failed repair is retried the next time the page loads
  }, [clubId, canManage, key, events]); // eslint-disable-line react-hooks/exhaustive-deps
}
```

- [ ] **Step 3:** `ClubApp`: call `useSessionSync({ clubId, club, events, canManage })` after `useEvents`; pass `club` to `useEventActions`.
- [ ] **Step 4: Verify** `node src/utils/sessions.check.mjs`, `npm run build`, and a rules test line in `tests/sessions.test.mjs`: a manager's `updateDoc` of the four meta fields on `pub/e1` succeeds and a plain member's fails. Commit (index tree build first).

---

### Task 4: The query hook, the session card and Find session

**Files:**
- Create: `src/hooks/useSessions.js`, `src/components/SessionCard.jsx`, `src/views/FindSession.jsx`
- Modify: `src/utils/route.js`, `src/utils/route.check.mjs`, `src/AccountApp.jsx`, `src/components/AccountSidebar.jsx`, `src/clubs.css` (HEAD-blob staging for the shared files)

**Interfaces:**
- `useSessions()` → `{ sessions, ready, error }`: one `onSnapshot` on `query(collectionGroup(db, "events"), where("clubPublic", "==", true), where("date", ">=", queryFromDate()), orderBy("date"), limit(100))`; `sessions` = `listedSessions(docs)` where each doc gets `id`, `clubId` (from `d.ref.parent.parent.id`, never trusted from the data), and the data. `ready` flips on the first snapshot or error.
- `SessionCard({ session, today, mine, navigate })` → a link card to `/clubs/{clubId}/event/{id}`: time range (`formatHM(start)` to `formatHM(endHM(...))`), `title` (falls back to "Open play"), club name (+ "Your club" pill when `mine`), a "Live now" pill when `status === "live"`, `spotsLabel`, fee (`money`, "Free" at 0), level when present.
- `routeOf("/sessions")` → `"sessions"` (add a check: `/sessions`, `/sessions/` → `sessions`; `/sessionsx` → `hub`).

- [ ] **Step 1:** route check RED → implement `route.js` → GREEN.
- [ ] **Step 2:** `useSessions` (follow `useMembership.js`: `firebaseConfigured` guard, error callback → `{ sessions: [], ready: true, error: true }`).
- [ ] **Step 3:** `SessionCard.jsx`: uses `DateTile` for the date, no avatars; the whole card is one `<a>` (focus ring from `.acct-shell a:focus-visible`), card content in plain text rows.
- [ ] **Step 4:** `FindSession.jsx`: `PageTitle` "Find session" sub "Open play and bookings from public clubs, joined or not."; `label.find-search` input (reuse the existing class) placeholder "Search by club, place or session"; a chip row (`role="group" aria-label="Day"`, buttons with `aria-pressed`) from `dateChips`, labels "Any day" / "Today" / "Tomorrow" / `formatDay`; the list grouped with `groupByDate(filterSessions(...))`, each group an `h2.club-section` from `dayHeading`; states: loading ("Loading sessions…"), error ("Couldn't load sessions. Check your connection and try again."), empty for the chosen day/search ("No sessions match. Try another day or Any day."), none at all ("No open play is scheduled yet. Check back soon, or find a club to join."), with a link to `/clubs/find`. `mine` is `clubs.some(c => c.id === s.clubId)` from the `clubs` prop. `today` is the device's local date (`new Date().toLocaleDateString("en-CA")`).
- [ ] **Step 5:** `AccountApp`: route `sessions` renders `<FindSession clubs={clubs} navigate={navigate} />`; sidebar `active` map gets `sessions: "sessions"`. `AccountSidebar`: first Play entry becomes `link("/sessions", "Find session", CalendarSearch, active === "sessions")` (lucide `CalendarSearch`; if the installed lucide lacks it use `CalendarDays`), "Find a club" stays under it.
- [ ] **Step 6:** CSS in `clubs.css` (tokens only): `.day-chips` (flex, wrap, gap 8px, chips min-height 44px, `[aria-pressed="true"]` uses `--accent` tint), `.session-card` (grid: date tile, details, spots/fee column; wraps to one column under 560px), `.session-card .pill.live` using the existing live-dot style if present, `.session-group` spacing. Keep `.find-search` as is.
- [ ] **Step 6b: Verify** `node src/utils/route.check.mjs`, `npm run build`; commit (index tree build first).

---

### Task 5: Home redesign

**Files:**
- Modify: `src/views/Hub.jsx`, `src/components/ActiveQueue.jsx`, `src/AccountApp.jsx` (pass `clubs` already; add nothing new), `src/clubs.css` (HEAD-blob staging where shared)

**Interfaces:**
- Consumes: `useSessions`, `SessionCard`, `groupByDate`, `dayHeading` (Tasks 1 and 4).
- `ActiveQueue` gains an `onNone` notion: it reports whether any queue card rendered so Home can show the empty card. Implementation: `ActiveQueue({ uid, clubs, navigate, onCount })` is not needed; instead Home keeps the CSS `:has` approach inverted: render `<p className="home-active-empty">…</p>` inside `.home-active` and hide it with `.home-active:has(.queue-card) .home-active-empty{display:none}`.

- [ ] **Step 1:** Hub layout (top to bottom), each region a `section` with an `h2.club-section`:
  1. `home-ready` bar: title "Ready to play?", text "Find a session to join, or start a quick game.", actions `.primary` **Find session** (`/sessions`, `Search` icon) and `.outline` **Quick session**.
  2. **Your active session**: `ActiveQueue` plus the CSS-hidden empty card "You're not in a session right now. Find one to join." with an `.outline` "Find session" link.
  3. **Coming up**: `useSessions()`; first 5 of `listedSessions` grouped by `groupByDate`, my clubs' sessions first inside a day; `SessionCard`s; while loading, three skeleton rows of fixed height (no layout jump); empty: "Nothing scheduled yet." + link "Find a club"; footer link "See all sessions" (`.outline`).
  4. A slim two-up row **Friends** (count, request badge) and **Inbox** (chat count, unread badge) as small link tiles (replace the tall `hub-card`s: `.home-tile` row, min-height 56px).
  5. **My clubs**: a compact list of `.club-row` links (name, role pill) and a text-style "Create a club" `.outline` button; the empty state "Create your first club" panel stays.
- [ ] **Step 2:** CSS: `.home-tiles` (two columns, one under 560px), `.home-tile`, `.club-row` list, `.home-active-empty`, `.home-active:has(.queue-card) .home-active-empty{display:none}`, remove `.home-active:not(:has(.queue-card)){display:none}`, `.session-skeleton`. Tokens only; visible focus; hover on rows is a background change, no layout shift.
- [ ] **Step 3: Verify** `npm run build`; commit (index tree build first).

---

### Task 6: Docs, browser pass, review

- [ ] Browser (emulators, `npm run emulators` + `npm run dev:emu`, seed with the scratch seed script plus events): two public clubs and one private club with future events (one without `clubPublic`); as a person who joined none: Home shows Coming up and the empty active card; `/sessions` lists only public clubs' sessions, filters by day and text, a card opens the event page and booking works; open the old event's club as its owner and see it appear after the sync; flip a club to private in Settings and confirm its sessions vanish from Find session; put a live game on a public club (check-in the person) and see the active card; phone layout (chips wrap, cards one column); dark theme.
- [ ] `CLAUDE.md` bullet (Find session: the four copied fields, the collection-group rule and index, `useSessionSync`, the files); memory note; remind the owner to republish `firestore.rules` **and deploy the index** (`firebase deploy --only firestore:indexes`).
- [ ] One whole-branch review (fresh opus reviewer) on these commits; fix Critical and Important with a failing test first.
