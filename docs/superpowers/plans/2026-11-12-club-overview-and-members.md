# Club Overview and Members (step 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The club's Overview and Members tabs in the CourtWave look, as in the approved mockup.

**Overview:**
- The next game is a deep green hero card on the wave. While a game is live, the Open play tab's "Live now" card takes
  its place.
- Under it, the next three games.
- On the right: three numbers and the latest three feed posts.

**Members:**
- a counts row;
- the lime "Waiting for you" card for join requests;
- a dark invite-link strip;
- everyone grouped into "Owner & managers" and "Members", with a search;
- row actions in a "⋯" menu.

**Architecture:** The pure logic goes in two places:
- `utils/clubOverview.js`: which game is live or next, what comes after it, and this month's numbers;
- `utils/clubs.js`: grouping, searching and counting members.

`ClubHome.jsx` and `ClubMembers.jsx` are rewritten around them. `Host.jsx` exports `LiveCard`, `timeLine` and
`Meter` so the Overview reuses them. No rules change and no new data.

**Tech Stack:** React 18, lucide-react, `node` assert checks.

**Spec:** `docs/superpowers/specs/2026-11-12-club-header-and-feed-design.md`, goals 5 and 6. Mockup:
`.superpowers/brainstorm/510-*/content/club-tabs.html`, sections 1, 2 and 4.

## Global Constraints

- Theme tokens only, light and dark. New styles go in a section "Club Overview and Members (2026-11-12)" at the end of
  `src/clubs.css`. Tap targets are about 40 px. Check at 390 px and 1280 px.
- Names stay plain: no avatars or initials beside people.
- A private club has no public booking page. There, **Book a spot**, **Share booking link** and "All open play" are
  hidden for members, and its rows have no action.
- Non-members of a public club who open the Overview see the games but no numbers and no posts (they can't read
  members or the feed).
- Commits: one commit at the end of the run (the owner asked).

## Review Focus

1. **No upcoming game:**
   - a manager sees an empty wave card with **Start new**;
   - a member sees a plain "No open play scheduled yet." card.
2. **Several live games:** each gets its own Live card, and the hero and Coming up skip live games.
3. **Exactly 8 or fewer members:** no search box. With 9 or more, the search filters both groups, and empty groups
   hide.
4. **The owner's own row:** no Message and no "⋯". A manager sees "⋯" only where `canChangeRole` / `canRemove` allow.
5. **A club with no invite code yet:** the strip shows **Create invite link** instead of the link.

---

### Task 1: Overview and member logic

**Files:**
- Create: `src/utils/clubOverview.js`, `src/utils/clubOverview.check.mjs`
- Modify: `src/utils/clubs.js` and `src/utils/clubs.check.mjs`

**Interfaces:**
- `overviewGames(events, fallbackZone) -> { live: event[], next: event | null, coming: event[] }`:
  - only events that are not over (`isOver`), sorted with `byStart`;
  - `live` is the events with `status === "live"`;
  - `next` is the first non-live event, and `coming` is the next 3 after it.
- `monthStats(events, todayYmd) -> { games, players }`:
  - only events whose `date` starts with this month's `YYYY-MM`;
  - `games` counts them, walk-ins included;
  - `players` sums the confirmed seats (`splitAttendees(e).confirmed.length`).
- `fillLine(event) -> string`:
  - `"6 of 8 booked · 2 spots left"`;
  - when full, `"Full · 2 waiting"`, or `"Full"` with nobody waiting;
  - for a walk-in, `"Walk-in"`.
- In `clubs.js`:
  - `groupMembers(members, query = "") -> { leads, others }`: leads are owners then managers, others are members;
    each group is sorted by name; the query matches the start of any word of the name, ignoring case.
  - `memberCounts(members) -> { members, managers }`, where `managers` counts the owner too.
  - `SEARCH_FROM = 9`.

- [ ] **Step 1: Write failing checks** covering:
  - **`overviewGames`:** a live game, two upcoming games and one past game give live 1, `next` as the earlier of the
    two, `coming` 1.
  - **`monthStats`:** two events in this month (2 + 3 confirmed, the first with `maxPlayers` 2 and 3 attendees, so
    one waits) and one next month give `{ games: 2, players: 4 }`.
  - **`fillLine`:** the three cases.
  - **`groupMembers`:** owner, manager and members split correctly; the query "re" finds "Ann Reyes"; an empty
    group stays empty.
  - **`memberCounts`.**
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expected: ok.

### Task 2: Overview screen

**Files:**
- Modify: `src/views/ClubHome.jsx` (rewrite), `src/views/Host.jsx` (export `LiveCard`, `timeLine`, `Meter`; the
  `LiveCard` action becomes a prop), `src/ClubApp.jsx` (pass `clubId`, `club`, `onShareBooking`, `today`, `uid`)

**Left column:**
- One `LiveCard` per live game:
  - managers get **Open game**;
  - members get **View queue** (`/event/:id/queue`).
- Otherwise the `.club-next` hero:
  - the heading "Next game · {dayHeading}";
  - the date tile, the title, `timeLine`, and a lime bar with `fillLine`;
  - actions:
    - managers: **Open event**, plus **Share booking link** for a public club;
    - members of a public club: **Book a spot**, an `<a>` to `/open-play?club=C&event=E`.
- **Coming up:** up to 3 rows (date tile, title, `timeLine`, bar), with the header "Coming up" and "All open play ›":
  - managers go to `/host`;
  - members of a public club go to `/open-play?club=C`;
  - members of a private club get no link.
- **Empty state:**
  - managers: the `host-empty` wave card "No open play *yet.*" with **Start new**;
  - others: a panel with "No open play scheduled yet."

**Right column (members only):**
- Three numbers: Members, "Games in {Mon}", "Players in {Mon}".
- "Latest posts": 3 from `feedOrder`, each with a "New" tag when `isNew`, then name · `formatDate`, and the text
  clipped to 2 lines. "View all ›" goes to the Feed.
- Under 960 px it all becomes one column, the right column after the left.

- [ ] Build, then check in the browser (ann, eli).

### Task 3: Members screen

**Files:**
- Modify: `src/views/ClubMembers.jsx` (rewrite)

**From top to bottom:**
- The `PageTitle` keeps **Leave club**.
- A counts row: "{n} members", "{n} managers", and for managers "{n} waiting to join".
- Join requests (managers): a lime card "Waiting for you" with rows of name, the message or "Asked {date}", and
  **Approve** / **Decline**.
- The invite strip (managers): a dark strip with the URL as text, **Copy** (`navigator.clipboard`, toast "Link
  copied."), and **New link** (the confirm text from `ClubShareMenu`). With no code, it shows **Create invite link**.
- A panel "Everyone {n}":
  - a search box once there are `SEARCH_FROM` or more;
  - the group headings "Owner & managers" and "Members";
  - rows of the name (" (you)"), "Joined {date}", the role pill, **Message** (not on your own row), and a `RowMenu`
    with Make manager / Remove manager / Remove from club, as allowed;
  - "No one matches." when the search finds nobody.

- [ ] Build, then check in the browser at 390 px and 1280 px, light and dark, as ann (owner) and eli (member).

### Task 4: Docs, review, commit

- [ ] Update `CLAUDE.md`, then run all checks, the rules tests touched this session and the build.
- [ ] One fresh reviewer, then fix what is Critical or Important.
- [ ] Commit.
