# Clubs, Part A: Clubs Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in person can create a club (public or private), see it under "My clubs", and as its owner manage it: create open play, run games, edit club settings, delete the club. Events, games and settings move from the account to the club. The account becomes only the person's profile.

**Architecture:** New top-level `clubs/{clubId}` documents with `members`, `events` (and the event subcollections that exist today) underneath; a small copy of each membership at `accounts/{uid}/memberships/{clubId}` powers "My clubs". Firestore rules check the club's member record, written now for owner, manager and member so parts B and C need no restructuring. The UI splits `AccountApp` (sign-in, hub, create club, profile) from a new `ClubApp` (club overview, open play, event page, game, settings). The queue app is untouched: it already runs on any path via `base`.

**Tech Stack:** React 19, Vite, Firebase Auth + Firestore, lucide-react, Firestore + Auth emulators, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-10-08-clubs-design.md` (part A). Builds on branch `feat/accounts-hub` at commit `51eb8c6`.

## Global Constraints

- Every color is a token on `:root` in `src/styles.css` (`var(--accent)`, `var(--line)`, `var(--hover)`, `var(--muted)`, `var(--warn)` …). Never raw hex. (CLAUDE.md)
- No avatar-initial badges next to names. Plain names only.
- Money through `money()`, times through `formatHM` / `formatTime` / `formatDay` in `utils/format.js`.
- No new dependencies. No router library.
- Copy: sentence case, active voice, errors say what went wrong and what to do. One name per action across screens ("Create club", "Delete club").
- **Modules that a `*.check.mjs` imports use relative imports with the `.js` extension** (`from "./clubs.js"`), because plain Node does not resolve extensionless paths.
- Do not use regexes or backslashes inside shell heredocs that edit files. For multi-line edits write a small `.cjs` script file (plain-string `split`/`join` with a "missing" check, as in the snippets below) or use the Edit tool, then grep the file to confirm.
- **Other people have uncommitted edits in the working tree** (the Dashboard leaderboard, cost pricing modes, Topbar, `format.js`, `styles.css`, `Stats.jsx`, `Cost.jsx`, `QueueApp.jsx`). Never stage them. Commit only the paths a step lists, never `git add -A` or `git add .`. All new club styles go in a **new file `src/clubs.css`** (imported by `main.jsx`) so `styles.css` is never touched.
- `dist/` is tracked: after every `npx vite build`, run `git checkout -- dist && git clean -fdq dist` and never commit a rebuild.
- `.playwright-mcp/` is tracked. Never `rm -rf` it; never `git add` it. Clean untracked screenshots with `git clean -fdq .playwright-mcp`.
- Commit steps assume you have approved committing. End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never deploy, push or merge. Publishing `firestore.rules` is the owner's action. **Browser checks in this plan run against the local emulators (Task 1), so they create no production data and need no published rules.**
- Browser checks use throwaway accounts on the emulator; the emulator forgets everything when it stops.

## Review Focus

Inputs and conditions the spec implies but the happy path will not exercise, most likely first:

1. **A stranger, a signed-out visitor or a plain member reaching a private club's events, game data, members or booking.** Pinned by the rules matrix (Task 3), including a private club and each role.
2. **Deleting a club, or an account that owns clubs, leaves nothing behind** (members, events, every event subcollection, roster, join requests, invite document, the membership copy, the legacy account events). Pinned by `tests/cascade.test.mjs` (Task 4).
3. **Opening a manager-only URL (`/clubs/:id/host`, `/event/...`, `/settings`) without being a manager.** The screen must say it is for managers and show no controls, never crash or render the controls. Pinned by the permission helper check (Task 2) and the browser steps (Task 8).
4. **An anonymous quick-session user or a legacy club login trying to create a club or an account profile.** Pinned by the `isRealUser` rules cases (Task 3).
5. **A club that does not exist, or was deleted while open**, and old bookmarks (`/host`, `/event/...`). Club pages show "Club not found" with a way back; old URLs land on the hub. Pinned by `route.check.mjs` (Task 2) and the browser steps (Task 8).

---

## File Structure

| File | Responsibility |
|---|---|
| `firebase.json`, `src/firebase.js`, `.env.emulator`, `package.json` (modify/create) | Run the app against the local emulators. |
| `src/utils/clubs.js` (new), `clubs.check.mjs` | Club input checks, a new club's documents, the membership copy, role permissions, club URLs. |
| `src/utils/route.js` (modify), `route.check.mjs` (rewrite), `src/hooks/useRoute.js` (modify) | Club routes; `clubIdOf`, `eventIdOf`; the quick session's route is now `quick`. |
| `src/utils/paths.js` (modify), `paths.check.mjs` | `eventBase(clubId, eventId)` is under `clubs/`. |
| `src/Club.jsx` → `src/QuickSession.jsx` (rename), `src/main.jsx` (modify) | Free the word "club"; import `clubs.css`. |
| `firestore.rules` (rewrite), `tests/rules.test.mjs` (rewrite) | Clubs, members, events, requests, memberships; the quick session rules unchanged. |
| `src/utils/accountData.js` (rewrite), `tests/cascade.test.mjs` (rewrite) | `deleteEventData`, `deleteClubData`, `deleteAccountData` for the club layout. |
| `src/hooks/useEvents.js`, `useEventPlayers.js`, `useEventActions.js`, `useGameActions.js` (modify) | Take a `clubId`, read and write under `clubs/`. |
| `src/hooks/useClubDoc.js`, `useMyClubs.js`, `useClubActions.js` (new) | The open club and the person's role; My clubs; create, update, delete. |
| `src/ClubApp.jsx` (new) | The club area: loads the club, guards by role, routes to its screens, owns the event modals. |
| `src/views/ClubHome.jsx`, `ClubSettings.jsx` (new), `src/components/ClubProfileSettings.jsx` (new) | Club overview and club settings. |
| `src/views/Host.jsx`, `EventPage.jsx`, `src/Game.jsx`, `src/views/Settings.jsx`, `src/components/DeleteAccountDialog.jsx` (modify) | Club-relative links, club settings mode, Delete club. |
| `src/AccountApp.jsx` (rewrite), `src/views/Hub.jsx` (rewrite), `src/views/CreateClub.jsx`, `src/views/Profile.jsx` (new), `src/hooks/useAccount.js`, `src/components/AccountLogin.jsx` (modify) | Sign-in shell, hub with My clubs, create club, profile. |
| `src/OpenPlay.jsx` (modify) | `?club=`; closed message for non-public clubs. |
| `src/clubs.css` (new) | Styles for the club shell and screens. |
| `CLAUDE.md`, the clubs spec (modify) | Document clubs; correct the game-data read rule. |

## Before you start

- [ ] Branch `feat/accounts-hub`. `git status` shows other people's edits (see Global Constraints); leave them. Run `npm run test:rules` once and confirm `rules: all assertions passed` and `cascade: ok`.
- [ ] Java and the Firebase CLI work (the rules tests already need them). Task 1 adds the Auth emulator; the CLI downloads it on first use.
- [ ] Tasks 5 to 7 change the app in pieces. The app is only runnable again after Task 7; Tasks 2 to 6 verify with unit checks, the rules emulator and `vite build`.
- [ ] **A correction to the spec, made in Task 3:** the game subcollections (`players`, `courts`, `matchLog`, `costs`) stay managers-only, as decided in step 3a. The spec's "everything under events is readable by the public" is narrowed to the event document and its `requests`.

---

### Task 1: Run the app against the emulators

**Files:**
- Modify: `firebase.json`, `src/firebase.js`, `package.json`
- Create: `.env.emulator`

**Interfaces:**
- Produces: `npm run emulators` (Auth on 9099, Firestore on 8080, project `demo-courtflow`) and `npm run dev:emu` (Vite on port 5300 pointed at them). Both use the rules in `firestore.rules`.

- [ ] **Step 1: Emulator config**

In `firebase.json`, add this key beside `"firestore"` and `"hosting"`:

```json
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  },
```

Create `.env.emulator`:

```
VITE_FIREBASE_API_KEY=demo-key
VITE_FIREBASE_AUTH_DOMAIN=demo-courtflow.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-courtflow
VITE_FIREBASE_APP_ID=demo-app
VITE_USE_EMULATORS=1
```

(It holds no secrets. If `git check-ignore .env.emulator` prints a path, add the line `!.env.emulator` to `.gitignore`.)

In `package.json` add to `"scripts"`:

```json
    "emulators": "firebase emulators:start --only auth,firestore --project demo-courtflow",
    "dev:emu": "vite --mode emulator --port 5300"
```

- [ ] **Step 2: Connect the app when asked**

In `src/firebase.js` change the two Firebase imports and append the connection:

```js
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";
```

and at the end of the file:

```js

// `npm run dev:emu` (with `npm run emulators` running) points the app at local emulators: no real
// data is touched and no published rules are needed. Normal builds never set this.
if (import.meta.env.VITE_USE_EMULATORS === "1") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
}
```

- [ ] **Step 3: Verify**

Run in the background: `npm run emulators`, wait for "All emulators ready", then `npm run dev:emu`. In a browser open `http://localhost:5300/`, create an account (any email such as `a@example.com`, password `secret12`): you reach the hub. Create an open play under Host open play. Stop both servers.
Expected: sign-up works with no network access to the real project. `npx vite build` still succeeds (then `git checkout -- dist && git clean -fdq dist`).

- [ ] **Step 4: Commit**

```bash
git add firebase.json src/firebase.js package.json .env.emulator
git commit -m "chore: run the app against the local Firebase emulators (npm run emulators, npm run dev:emu)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Club helpers, routes and paths

**Files:**
- Create: `src/utils/clubs.js`, `src/utils/clubs.check.mjs`
- Modify: `src/utils/route.js`, `src/utils/route.check.mjs`, `src/utils/paths.js`, `src/utils/paths.check.mjs`, `src/hooks/useRoute.js`, `src/main.jsx`
- Rename: `src/Club.jsx` → `src/QuickSession.jsx`

**Interfaces:**
- Produces: `VISIBILITIES`, `validateClubInput(input): string` (empty = fine), `newClubDoc(input, ownerId, now)`, `membershipCopy(club, role, now)`, `permissions(role): { isMember, canManage, isOwner }`, `clubPath(clubId, rest?)`; `routeOf` returns `hub | quick | live | open-play | settings | clubs | clubs-new | club | club-host | club-event | club-game | club-settings`; `clubIdOf(pathname)`, `eventIdOf(pathname)`; `useRoute()` returns `{ route, clubId, eventId, navigate }`; `eventBase(clubId, eventId)`.

- [ ] **Step 1: Write the failing checks**

Create `src/utils/clubs.check.mjs`:

```js
// Self-check for club helpers. Run: node src/utils/clubs.check.mjs
import assert from "node:assert";
import { clubPath, membershipCopy, newClubDoc, permissions, validateClubInput } from "./clubs.js";

// Input checks: each failure says what to fix.
assert.equal(validateClubInput({ name: "Centro", visibility: "public" }), "");
assert.match(validateClubInput({ name: "  ", visibility: "public" }), /name/i);
assert.match(validateClubInput({ name: "x".repeat(61), visibility: "public" }), /60/);
assert.match(validateClubInput({ name: "A", description: "x".repeat(501), visibility: "public" }), /500/);
assert.match(validateClubInput({ name: "A", location: "x".repeat(101), visibility: "public" }), /100/);
assert.match(validateClubInput({ name: "A", visibility: "secret" }), /public or private/i);
assert.equal(validateClubInput({ name: "A" }), ""); // visibility defaults to public

// A new club: trimmed text, a lowercase copy of the name for search, the owner, and working settings.
const club = newClubDoc({ name: "  Centro Pickle  ", description: " Fun ", location: " Manila ", visibility: "private" }, "u1", 99);
assert.equal(club.name, "Centro Pickle");
assert.equal(club.nameLower, "centro pickle");
assert.equal(club.description, "Fun");
assert.equal(club.location, "Manila");
assert.equal(club.visibility, "private");
assert.equal(club.ownerId, "u1");
assert.equal(club.createdAt, 99);
assert.deepEqual(club.defaults, { courts: 2, format: "Doubles", mode: "Balanced" });
assert.equal(club.rules.maxWinStreak, 2);
assert.equal(club.display.timeZone, "Asia/Manila");
assert.equal(newClubDoc({ name: "A" }, "u1", 1).visibility, "public");
// Settings are copies, so editing one club never changes another.
assert.notStrictEqual(newClubDoc({ name: "A" }, "u1", 1).rules, newClubDoc({ name: "B" }, "u1", 1).rules);

assert.deepEqual(membershipCopy(club, "owner", 5), { clubName: "Centro Pickle", role: "owner", joinedAt: 5 });

// Review Focus 3: what each role may do (a missing or unknown role may do nothing).
assert.deepEqual(permissions("owner"), { isMember: true, canManage: true, isOwner: true });
assert.deepEqual(permissions("manager"), { isMember: true, canManage: true, isOwner: false });
assert.deepEqual(permissions("member"), { isMember: true, canManage: false, isOwner: false });
assert.deepEqual(permissions(null), { isMember: false, canManage: false, isOwner: false });
assert.deepEqual(permissions("hacker"), { isMember: false, canManage: false, isOwner: false });

assert.equal(clubPath("abc"), "/clubs/abc");
assert.equal(clubPath("abc", "/host"), "/clubs/abc/host");
assert.equal(clubPath("a b", "/settings"), "/clubs/a%20b/settings");

console.log("clubs.check: ok");
```

Replace `src/utils/route.check.mjs` with:

```js
// Self-check for page routing. Run: node src/utils/route.check.mjs
import assert from "node:assert";
import { clubIdOf, eventIdOf, routeOf } from "./route.js";

assert.equal(routeOf("/"), "hub");
assert.equal(routeOf(""), "hub");
assert.equal(routeOf("/settings"), "settings");
assert.equal(routeOf("/settings/"), "settings");
assert.equal(routeOf("/live"), "live");
assert.equal(routeOf("/open-play"), "open-play");
assert.equal(routeOf("/open-play/"), "open-play");
// The quick session keeps its URL; its route is named "quick" so "club" can mean a real club.
assert.equal(routeOf("/club"), "quick");
assert.equal(routeOf("/club/"), "quick");
assert.equal(routeOf("/clubhouse"), "hub");

assert.equal(routeOf("/clubs"), "clubs");
assert.equal(routeOf("/clubs/"), "clubs");
assert.equal(routeOf("/clubs/new"), "clubs-new");
assert.equal(routeOf("/clubs/abc"), "club");
assert.equal(routeOf("/clubs/abc/"), "club");
assert.equal(routeOf("/clubs/abc/host"), "club-host");
assert.equal(routeOf("/clubs/abc/settings"), "club-settings");
assert.equal(routeOf("/clubs/abc/event/e1"), "club-event");
assert.equal(routeOf("/clubs/abc/event/e1/"), "club-event");
assert.equal(routeOf("/clubs/abc/event/e1/game"), "club-game");
assert.equal(routeOf("/clubs/abc/event/e1/game/"), "club-game");

// Review Focus 5: unknown paths and the old pre-club URLs land on the hub, not a blank page.
assert.equal(routeOf("/clubs/abc/nope"), "hub");
assert.equal(routeOf("/clubs/abc/event"), "hub");
assert.equal(routeOf("/clubs/abc/event/e1/gamex"), "hub");
assert.equal(routeOf("/clubs/abc/event/e1/game/x"), "hub");
assert.equal(routeOf("/nope"), "hub");
assert.equal(routeOf("/host"), "hub");
assert.equal(routeOf("/event/abc"), "hub");
assert.equal(routeOf("/settings/extra"), "hub");

assert.equal(clubIdOf("/clubs/abc"), "abc");
assert.equal(clubIdOf("/clubs/abc/host"), "abc");
assert.equal(clubIdOf("/clubs/abc/event/e1/game"), "abc");
assert.equal(clubIdOf("/clubs/a%20b/"), "a b");
assert.equal(clubIdOf("/clubs"), null);
assert.equal(clubIdOf("/clubs/new"), null);
assert.equal(clubIdOf("/club"), null);
assert.equal(clubIdOf("/"), null);

assert.equal(eventIdOf("/clubs/c1/event/e1"), "e1");
assert.equal(eventIdOf("/clubs/c1/event/e1/game"), "e1");
assert.equal(eventIdOf("/clubs/c1/event/abc%20x/game/"), "abc x");
assert.equal(eventIdOf("/clubs/c1/host"), null);
assert.equal(eventIdOf("/clubs/c1/event/"), null);
assert.equal(eventIdOf("/clubs/c1/event/e1/gamex"), null);

console.log("route.check: ok");
```

In `src/utils/paths.check.mjs` replace the `eventBase` assertions with:

```js
assert.deepEqual(eventBase("c1", "e1"), ["clubs", "c1", "events", "e1"]);
assert.equal(eventBase("c1", undefined), null);
assert.equal(eventBase(undefined, "e1"), null);
```

(keep the `sessionBase` assertions and the final `console.log`).

- [ ] **Step 2: Run them to verify they fail**

Run: `node src/utils/clubs.check.mjs; node src/utils/route.check.mjs; node src/utils/paths.check.mjs`
Expected: `clubs.check` FAILS with `ERR_MODULE_NOT_FOUND`; `route.check` FAILS (`clubIdOf` not exported); `paths.check` FAILS with an `AssertionError` on the club base.

- [ ] **Step 3: Implement**

Create `src/utils/clubs.js`:

```js
// Pure rules for clubs: input checks, the documents a new club starts with, what each role may do,
// and club URLs. No Firestore here (that is useClubActions), so all of it is covered by clubs.check.mjs.
import { DEFAULT_COST, DEFAULT_DISPLAY, DEFAULT_LIVE, DEFAULT_RULES, seedSession } from "../data/constants.js";

export const VISIBILITIES = ["public", "private"];

// "" when fine, otherwise a message that says what to fix.
export function validateClubInput({ name = "", description = "", location = "", visibility = "public" }) {
  if (!name.trim()) return "Give your club a name.";
  if (name.trim().length > 60) return "Club names can be up to 60 characters.";
  if (description.trim().length > 500) return "The description can be up to 500 characters.";
  if (location.trim().length > 100) return "The location can be up to 100 characters.";
  if (!VISIBILITIES.includes(visibility)) return "Choose public or private.";
  return "";
}

// The club document a new club starts with. `nameLower` is for the directory search in part B.
export function newClubDoc({ name, description = "", location = "", visibility = "public" }, ownerId, now) {
  return {
    name: name.trim(),
    nameLower: name.trim().toLowerCase(),
    description: description.trim(),
    location: location.trim(),
    visibility,
    ownerId,
    createdAt: now,
    defaults: { courts: seedSession.courts, format: seedSession.format, mode: seedSession.mode },
    rules: { ...DEFAULT_RULES },
    costDefaults: { ...DEFAULT_COST },
    live: { ...DEFAULT_LIVE },
    display: { ...DEFAULT_DISPLAY },
  };
}

// The small copy under the person's account that powers "My clubs" without a database index.
export const membershipCopy = (club, role, now) => ({ clubName: club.name, role, joinedAt: now });

const RANK = { member: 1, manager: 2, owner: 3 };

// What a role may do in the screens (the rules enforce the same table on the server).
export function permissions(role) {
  const rank = RANK[role] || 0;
  return { isMember: rank >= 1, canManage: rank >= 2, isOwner: rank === 3 };
}

export const clubPath = (clubId, rest = "") => `/clubs/${encodeURIComponent(clubId)}${rest}`;
```

Replace `src/utils/route.js` with:

```js
// Which page a path belongs to. main.jsx picks the page from it; AccountApp and ClubApp use it
// for screens. Unknown paths, and the old pre-club URLs (/host, /event/...), go to the hub.
export function routeOf(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/live") return "live";
  if (path === "/open-play") return "open-play";
  if (path === "/club") return "quick";
  if (path === "/settings") return "settings";
  if (path === "/clubs") return "clubs";
  if (path === "/clubs/new") return "clubs-new";
  const m = path.match(/^\/clubs\/[^/]+(\/.*)?$/);
  if (m) {
    const rest = m[1] || "";
    if (rest === "") return "club";
    if (rest === "/host") return "club-host";
    if (rest === "/settings") return "club-settings";
    if (/^\/event\/[^/]+$/.test(rest)) return "club-event";
    if (/^\/event\/[^/]+\/game$/.test(rest)) return "club-game";
  }
  return "hub";
}

// "/clubs/<id>/..." -> "<id>" (decoded), else null. "/clubs/new" is not a club.
export function clubIdOf(pathname) {
  const m = pathname.replace(/\/+$/, "").match(/^\/clubs\/([^/]+)/);
  return m && m[1] !== "new" ? decodeURIComponent(m[1]) : null;
}

// "/clubs/<id>/event/<eventId>[/game]" -> "<eventId>" (decoded), else null.
export function eventIdOf(pathname) {
  const m = pathname.replace(/\/+$/, "").match(/^\/clubs\/[^/]+\/event\/([^/]+?)(?:\/game)?$/);
  return m ? decodeURIComponent(m[1]) : null;
}
```

Read the file back and confirm every backslash survived (`grep -n 'event' src/utils/route.js`).

In `src/utils/paths.js` change the last line to:

```js
export const eventBase = (clubId, eventId) => (clubId && eventId ? ["clubs", clubId, "events", eventId] : null);
```

and update its comment to say a game is `clubs/{clubId}/events/{eventId}`.

Replace the `useRoute` hook body in `src/hooks/useRoute.js` so it reads:

```js
import { useEffect, useState } from "react";
import { clubIdOf, eventIdOf, routeOf } from "../utils/route";

export function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (to) => {
    window.history.pushState({}, "", to);
    setPath(to);
  };
  return { route: routeOf(path), clubId: clubIdOf(path), eventId: eventIdOf(path), navigate };
}
```

Rename the quick session wrapper and wire the entry point:

```bash
git mv src/Club.jsx src/QuickSession.jsx
```

In `src/QuickSession.jsx` rename the component: `export default function Club() {` becomes `export default function QuickSession() {`.

In `src/main.jsx`: change `const App = lazy(() => import("./Club"));` to `const QuickSession = lazy(() => import("./QuickSession"));`, change `const pages = { live: LiveBoard, "open-play": OpenPlay, club: App };` to `const pages = { live: LiveBoard, "open-play": OpenPlay, quick: QuickSession };`, update the comment above it to say `/club` is the quick session, and add `import "./clubs.css";` directly under `import "./styles.css";`. Create an empty-for-now `src/clubs.css` containing only the comment `/* Styles for clubs: the club shell, overview, create form and settings. Tokens only. */`.

- [ ] **Step 4: Run them to verify they pass**

Run: `node src/utils/clubs.check.mjs && node src/utils/route.check.mjs && node src/utils/paths.check.mjs && node src/utils/gameSession.check.mjs`
Expected: `clubs.check: ok`, `route.check: ok`, `paths.check: ok`, `gameSession.check: ok`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/clubs.js src/utils/clubs.check.mjs src/utils/route.js src/utils/route.check.mjs src/utils/paths.js src/utils/paths.check.mjs src/hooks/useRoute.js src/main.jsx src/QuickSession.jsx src/clubs.css
git commit -m "feat: club helpers, club routes, club event paths; quick session route renamed" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(`git mv` already staged the rename; confirm `git status` shows `renamed: src/Club.jsx -> src/QuickSession.jsx`. The app does not build into a working state for club screens until Task 7.)

---

### Task 3: Rules and the rules matrix

**Files:**
- Rewrite: `firestore.rules`, `tests/rules.test.mjs`
- Modify: `docs/superpowers/specs/2026-10-08-clubs-design.md`

**Interfaces:**
- Produces the rules described in the spec: helpers `isRealUser`, `isMember`, `isManager`, `isOwner`, `isPublicClub`, `canSeeClub`; paths `clubs/{id}`, `clubs/{id}/members/{uid}`, `events` with `requests` and game subcollections (managers only), `roster`, `joinRequests`, `private`; `accounts/{uid}/**` owner-only for real users; the quick-session rules unchanged.

- [ ] **Step 1: Write the failing tests**

Replace `tests/rules.test.mjs` with:

```js
// Firestore rules test. Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import {
  collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch,
} from "firebase/firestore";

const rules = fs.readFileSync(process.env.RULES || "firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "rules-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

// ---- Seed (rules off): a public and a private club, each with an owner, a manager and a member.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "sessions/club1/players/p1"), { name: "P" });
  await setDoc(doc(db, "accounts/own"), { name: "Owner" });
  await setDoc(doc(db, "accounts/own/memberships/pub"), { clubName: "Public", role: "owner", joinedAt: 1 });
  await setDoc(doc(db, "accounts/own/events/legacy1"), { title: "Old", attendees: [] });
  for (const id of ["pub", "priv"]) {
    await setDoc(doc(db, `clubs/${id}`), { name: id, nameLower: id, visibility: id === "pub" ? "public" : "private", ownerId: "own", createdAt: 1 });
    await setDoc(doc(db, `clubs/${id}/members/own`), { role: "owner", name: "Owner", joinedAt: 1 });
    await setDoc(doc(db, `clubs/${id}/members/mgr`), { role: "manager", name: "Manager", joinedAt: 1 });
    await setDoc(doc(db, `clubs/${id}/members/mem`), { role: "member", name: "Member", joinedAt: 1 });
    await setDoc(doc(db, `clubs/${id}/events/e1`), { title: "Saturday", date: "2026-10-10", attendees: [] });
    await setDoc(doc(db, `clubs/${id}/events/e1/players/p1`), { name: "P" });
    await setDoc(doc(db, `clubs/${id}/events/e1/requests/r0`), { name: "Dee", contact: "0917", method: "cash", seatId: "s0", status: "pending", createdAt: Date.now() });
    await setDoc(doc(db, `clubs/${id}/roster/x`), { name: "Regular" });
    await setDoc(doc(db, `clubs/${id}/joinRequests/jr`), { name: "J", status: "pending" });
    await setDoc(doc(db, `clubs/${id}/private/invite`), { code: "SECRET" });
  }
});

// ---- Who is who. Real people sign in with a provider; quick sessions are anonymous; old club logins use fake emails.
const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anon = env.unauthenticatedContext().firestore();
const quick = env.authenticatedContext("q1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const legacy = env.authenticatedContext("c1", { email: "club1@courtflow.local", firebase: { sign_in_provider: "password" } }).firestore();
const club1 = env.authenticatedContext("club1").firestore();
const club2 = env.authenticatedContext("club2").firestore();
const own = real("own"), mgr = real("mgr"), mem = real("mem"), stranger = real("str");
const u1 = real("u1"), u2 = real("u2");

// ---- Quick sessions (sessions/**): unchanged
await assertSucceeds(getDoc(doc(anon, "sessions/club1/players/p1")));
await assertSucceeds(getDocs(collection(anon, "sessions/club1/players")));
await assertFails(updateDoc(doc(anon, "sessions/club1/players/p1"), { name: "evil" }));
await assertSucceeds(setDoc(doc(club1, "sessions/club1/bookings/b3"), { title: "ok" }));
await assertFails(setDoc(doc(club2, "sessions/club1/bookings/b4"), { title: "no" }));
await assertSucceeds(setDoc(doc(club1, "sessions/club1"), { location: "Quick session" }));
await assertSucceeds(setDoc(doc(u1, "sessions/u1"), { location: "Account quick session" }));
await assertSucceeds(setDoc(doc(quick, "sessions/q1"), { location: "Anonymous quick session" }));
await assertFails(setDoc(doc(u2, "sessions/u1/players/p2"), { name: "evil" }));
await assertFails(setDoc(doc(anon, "sessions/club1"), { location: "evil" }));
await assertFails(setDoc(doc(legacy, "sessions/club1"), { location: "old" }));
await assertFails(setDoc(doc(anon, "sessions/club1/bookingRequests/old1"), { name: "x" }));

// ---- Accounts (accounts/{uid}/**): the person only, and only real people
await assertSucceeds(setDoc(doc(u1, "accounts/u1"), { name: "One", createdAt: 1 }));
await assertSucceeds(updateDoc(doc(u1, "accounts/u1"), { name: "One!" }));
await assertSucceeds(setDoc(doc(u1, "accounts/u1/memberships/c9"), { clubName: "C", role: "owner", joinedAt: 1 }));
await assertSucceeds(getDocs(collection(u1, "accounts/u1/memberships")));
await assertFails(getDoc(doc(u2, "accounts/u1")));
await assertFails(getDocs(collection(u2, "accounts/u1/memberships")));
await assertFails(setDoc(doc(u2, "accounts/u1/memberships/c9"), { clubName: "evil", role: "owner", joinedAt: 1 }));
await assertFails(getDoc(doc(anon, "accounts/u1")));
// Review Focus 4: a quick-session (anonymous) user and an old club login are not people with accounts.
await assertFails(setDoc(doc(quick, "accounts/q1"), { name: "anon" }));
await assertFails(setDoc(doc(legacy, "accounts/c1"), { name: "sneaky" }));
await assertFails(getDoc(doc(legacy, "accounts/c1")));
// Events from before clubs, left under an account, are not public any more.
await assertFails(getDoc(doc(anon, "accounts/own/events/legacy1")));
await assertSucceeds(getDoc(doc(own, "accounts/own/events/legacy1")));

// ---- Clubs: create
const newClub = (ownerId, extra = {}) => ({ name: "Fresh", nameLower: "fresh", visibility: "public", ownerId, createdAt: 1, ...extra });
await assertSucceeds(setDoc(doc(u1, "clubs/mine"), newClub("u1")));
await assertSucceeds(setDoc(doc(u1, "clubs/mine2"), newClub("u1", { visibility: "private", description: "d", location: "Manila" })));
await assertFails(setDoc(doc(u1, "clubs/x1"), newClub("u2"))); // can't make a club for someone else
await assertFails(setDoc(doc(anon, "clubs/x2"), newClub("u1")));
await assertFails(setDoc(doc(quick, "clubs/x3"), newClub("q1"))); // Review Focus 4
await assertFails(setDoc(doc(legacy, "clubs/x4"), newClub("c1")));
await assertFails(setDoc(doc(u1, "clubs/x5"), newClub("u1", { name: "" })));
await assertFails(setDoc(doc(u1, "clubs/x6"), newClub("u1", { name: "x".repeat(61) })));
await assertFails(setDoc(doc(u1, "clubs/x7"), newClub("u1", { visibility: "secret" })));
await assertFails(setDoc(doc(u1, "clubs/x8"), newClub("u1", { description: "x".repeat(501) })));

// The owner's member record is created in the same batch as the club, and only then.
{
  const b = writeBatch(u2);
  b.set(doc(u2, "clubs/batch1"), newClub("u2"));
  b.set(doc(u2, "clubs/batch1/members/u2"), { role: "owner", name: "Two", joinedAt: 1 });
  b.set(doc(u2, "accounts/u2/memberships/batch1"), { clubName: "Fresh", role: "owner", joinedAt: 1 });
  await assertSucceeds(b.commit());
}
await assertFails(setDoc(doc(u2, "clubs/mine/members/u2"), { role: "owner", name: "Two", joinedAt: 1 })); // someone else's club
await assertFails(setDoc(doc(u2, "clubs/mine/members/u2"), { role: "member", name: "Two", joinedAt: 1 })); // no self-join in part A
await assertFails(setDoc(doc(u2, "clubs/mine/members/u1"), { role: "owner", name: "Two", joinedAt: 1 })); // another person's record

// ---- Clubs: read
await assertSucceeds(getDoc(doc(anon, "clubs/pub"))); // public: anyone, no sign-in
await assertFails(getDoc(doc(anon, "clubs/priv")));
await assertFails(getDoc(doc(quick, "clubs/priv")));
await assertSucceeds(getDoc(doc(stranger, "clubs/priv"))); // private: any signed-in person who has the address
await assertSucceeds(getDocs(query(collection(anon, "clubs"), where("visibility", "==", "public")))); // the directory
await assertFails(getDocs(collection(anon, "clubs"))); // no listing everything
await assertFails(getDocs(collection(stranger, "clubs")));
await assertFails(getDocs(query(collection(stranger, "clubs"), where("visibility", "==", "private")))); // private clubs are never listed

// ---- Clubs: update and delete
await assertSucceeds(updateDoc(doc(own, "clubs/pub"), { description: "Hello" }));
await assertSucceeds(updateDoc(doc(own, "clubs/pub"), { visibility: "private" }));
await assertSucceeds(updateDoc(doc(own, "clubs/pub"), { visibility: "public" }));
await assertSucceeds(updateDoc(doc(mgr, "clubs/pub"), { name: "Renamed", nameLower: "renamed" }));
await assertFails(updateDoc(doc(mgr, "clubs/pub"), { visibility: "private" })); // owner only
await assertFails(updateDoc(doc(mgr, "clubs/pub"), { ownerId: "mgr" }));
await assertFails(updateDoc(doc(own, "clubs/pub"), { ownerId: "mgr" }));
await assertFails(updateDoc(doc(mem, "clubs/pub"), { name: "no" }));
await assertFails(updateDoc(doc(stranger, "clubs/pub"), { name: "no" }));
await assertFails(updateDoc(doc(anon, "clubs/pub"), { name: "no" }));
await assertFails(updateDoc(doc(own, "clubs/pub"), { name: "" }));
await assertFails(deleteDoc(doc(mgr, "clubs/pub")));
await assertFails(deleteDoc(doc(mem, "clubs/pub")));
await assertFails(deleteDoc(doc(stranger, "clubs/pub")));

// ---- Members
await assertSucceeds(getDoc(doc(stranger, "clubs/pub/members/str"))); // your own record, even when there is none
await assertFails(getDoc(doc(stranger, "clubs/pub/members/mem"))); // someone else's record
await assertSucceeds(getDocs(collection(mem, "clubs/pub/members")));
await assertSucceeds(getDocs(collection(own, "clubs/priv/members")));
await assertFails(getDocs(collection(stranger, "clubs/pub/members")));
await assertFails(getDocs(collection(anon, "clubs/pub/members")));
await assertFails(updateDoc(doc(own, "clubs/pub/members/mem"), { role: "manager" })); // roles arrive in part C
await assertFails(deleteDoc(doc(mgr, "clubs/pub/members/mem")));
await assertFails(deleteDoc(doc(own, "clubs/pub/members/own"))); // the owner can't leave a club that still exists
await assertSucceeds(deleteDoc(doc(own, "clubs/priv/members/mem")));
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "clubs/priv/members/mem"), { role: "member", name: "Member", joinedAt: 1 }));

// ---- Events: read
await assertSucceeds(getDoc(doc(anon, "clubs/pub/events/e1"))); // public club: anyone
await assertSucceeds(getDocs(collection(anon, "clubs/pub/events")));
await assertFails(getDoc(doc(anon, "clubs/priv/events/e1"))); // Review Focus 1: private club
await assertFails(getDoc(doc(stranger, "clubs/priv/events/e1")));
await assertFails(getDoc(doc(quick, "clubs/priv/events/e1")));
await assertFails(getDocs(collection(stranger, "clubs/priv/events")));
await assertSucceeds(getDoc(doc(mem, "clubs/priv/events/e1")));
await assertSucceeds(getDocs(collection(mgr, "clubs/priv/events")));
// ---- Events: write (managers only)
await assertSucceeds(setDoc(doc(own, "clubs/pub/events/e2"), { title: "Mine", attendees: [] }));
await assertSucceeds(updateDoc(doc(mgr, "clubs/pub/events/e1"), { title: "Edited" }));
await assertFails(setDoc(doc(mem, "clubs/pub/events/e3"), { title: "no" }));
await assertFails(setDoc(doc(stranger, "clubs/pub/events/e3"), { title: "no" }));
await assertFails(setDoc(doc(anon, "clubs/pub/events/e3"), { title: "no" }));
await assertFails(updateDoc(doc(anon, "clubs/pub/events/e1"), { title: "evil" }));
await assertFails(deleteDoc(doc(mem, "clubs/pub/events/e1")));

// ---- Game data under an event: managers only (names stay private until the Live Board decides what to show)
const g = (db, club, path) => doc(db, `clubs/${club}/events/e1`, path);
await assertSucceeds(setDoc(g(own, "pub", "players/p2"), { name: "P", checked: false }));
await assertSucceeds(setDoc(g(mgr, "pub", "courts/court-1"), { courtNumber: 1 }));
await assertSucceeds(setDoc(g(mgr, "pub", "matchLog/m1"), { court: "Court 1" }));
await assertSucceeds(setDoc(g(mgr, "pub", "costs/booking-e1"), { label: "Saturday" }));
await assertSucceeds(getDocs(collection(mgr, "clubs/pub/events/e1/players")));
await assertFails(getDoc(g(anon, "pub", "players/p1")));
await assertFails(getDoc(g(stranger, "pub", "players/p1")));
await assertFails(getDoc(g(mem, "pub", "players/p1")));
await assertFails(getDocs(collection(mem, "clubs/pub/events/e1/courts")));
await assertFails(setDoc(g(mem, "pub", "players/p3"), { name: "evil" }));
await assertFails(setDoc(g(anon, "pub", "players/p3"), { name: "evil" }));
await assertFails(deleteDoc(g(stranger, "pub", "courts/court-1")));

// ---- Join requests for an event (a player's request): a validated pending create, one read by id, never a list
const req = (clubId) => (db) => collection(db, `clubs/${clubId}/events/e1/requests`);
const pubReq = req("pub"), privReq = req("priv");
const goodReq = { name: "Dee", contact: "0917 555 0100", method: "online", ref: "GC1", seatId: "seat-1", status: "pending", createdAt: Date.now() };
const cashReq = { name: "Dee", contact: "0917", method: "cash", seatId: "seat-2", status: "pending", createdAt: Date.now() };
await assertSucceeds(setDoc(doc(pubReq(anon), "r1"), goodReq)); // public club, nobody signed in
await assertSucceeds(setDoc(doc(pubReq(anon), "r2"), cashReq));
await assertSucceeds(setDoc(doc(pubReq(stranger), "r16"), { ...goodReq, createdAt: Date.now() - 60000 }));
await assertFails(setDoc(doc(pubReq(anon), "r3"), { ...goodReq, status: "approved" }));
await assertFails(setDoc(doc(pubReq(anon), "r4"), { ...goodReq, extra: 1 }));
await assertFails(setDoc(doc(pubReq(anon), "r5"), { ...goodReq, name: "" }));
await assertFails(setDoc(doc(pubReq(anon), "r6"), { ...goodReq, name: "x".repeat(61) }));
await assertFails(setDoc(doc(pubReq(anon), "r7"), { ...goodReq, method: "bitcoin" }));
await assertFails(setDoc(doc(pubReq(anon), "r8"), { ...goodReq, createdAt: "now" }));
await assertFails(setDoc(doc(pubReq(anon), "r9"), { ...goodReq, bookingId: "e1" }));
const { seatId: _s, ...noSeat } = goodReq;
await assertFails(setDoc(doc(pubReq(anon), "r11"), noSeat));
await assertFails(setDoc(doc(pubReq(anon), "r12"), { ...goodReq, seatId: 5 }));
await assertFails(setDoc(doc(pubReq(anon), "r13"), { ...goodReq, seatId: "x".repeat(61) }));
await assertFails(setDoc(doc(pubReq(anon), "r14"), { ...goodReq, createdAt: 0 })); // can't pick your place in line
await assertFails(setDoc(doc(pubReq(anon), "r15"), { ...goodReq, createdAt: Date.now() + 86400000 }));
await assertFails(setDoc(doc(anon, "clubs/pub/events/nope/requests/r10"), goodReq)); // event must exist
await assertFails(setDoc(doc(anon, "clubs/nope/events/e1/requests/r10"), goodReq)); // club must exist
// Review Focus 1: a private club's booking is for its members.
await assertFails(setDoc(doc(privReq(anon), "p1"), goodReq));
await assertFails(setDoc(doc(privReq(stranger), "p2"), goodReq));
await assertSucceeds(setDoc(doc(privReq(mem), "p3"), goodReq));
// Reading and managing requests.
await assertSucceeds(getDoc(doc(pubReq(anon), "r1")));
await assertFails(getDoc(doc(privReq(anon), "r0")));
await assertSucceeds(getDoc(doc(privReq(mem), "p3")));
await assertFails(getDocs(pubReq(anon))); // phone numbers: no public list
await assertFails(getDocs(pubReq(stranger)));
await assertFails(getDocs(pubReq(mem)));
await assertSucceeds(getDocs(pubReq(mgr)));
await assertSucceeds(getDocs(privReq(own)));
await assertFails(updateDoc(doc(pubReq(anon), "r1"), { status: "approved" }));
await assertFails(deleteDoc(doc(pubReq(anon), "r1")));
await assertFails(setDoc(doc(pubReq(anon), "r1"), goodReq)); // overwrite = update
await assertSucceeds(updateDoc(doc(pubReq(mgr), "r1"), { status: "approved" }));
await assertSucceeds(deleteDoc(doc(pubReq(own), "r2")));
await assertFails(updateDoc(doc(pubReq(mem), "r16"), { status: "approved" }));

// ---- Roster, join requests and the invite document
await assertSucceeds(getDocs(collection(mem, "clubs/pub/roster")));
await assertFails(getDocs(collection(stranger, "clubs/pub/roster")));
await assertFails(getDocs(collection(anon, "clubs/pub/roster")));
await assertSucceeds(setDoc(doc(mgr, "clubs/pub/roster/y"), { name: "New" }));
await assertFails(setDoc(doc(mem, "clubs/pub/roster/z"), { name: "evil" }));
await assertSucceeds(getDocs(collection(mgr, "clubs/pub/joinRequests")));
await assertFails(getDocs(collection(mem, "clubs/pub/joinRequests")));
await assertFails(getDocs(collection(stranger, "clubs/pub/joinRequests")));
await assertSucceeds(getDoc(doc(mgr, "clubs/pub/private/invite")));
await assertFails(getDoc(doc(mem, "clubs/pub/private/invite"))); // the invite code never leaks to members or the public
await assertFails(getDoc(doc(anon, "clubs/pub/private/invite")));
await assertFails(getDoc(doc(stranger, "clubs/priv/private/invite")));

// ---- Deleting a club (the order the app uses): the club doc first (needs the owner record), then the owner's own record
await assertFails(deleteDoc(doc(u1, "clubs/mine2"))); // u1 made it with no owner record in this test, so is no manager
await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "clubs/mine/members/u1"), { role: "owner", name: "One", joinedAt: 1 }));
await assertSucceeds(deleteDoc(doc(u1, "clubs/mine")));
await assertSucceeds(deleteDoc(doc(u1, "clubs/mine/members/u1"))); // allowed once the club is gone
await assertSucceeds(deleteDoc(doc(u2, "clubs/batch1"))); // the club made in the batch above
await assertSucceeds(deleteDoc(doc(u2, "clubs/batch1/members/u2")));

console.log("rules: all assertions passed");
await env.cleanup();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:rules`
Expected: it FAILS with a `FirebaseError ... permission-denied` (the current rules know nothing of `clubs`) at the first club assertion. The earlier quick-session and account assertions may also fail; that is fine.

- [ ] **Step 3: Write the rules**

Replace `firestore.rules` with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // ---- Quick sessions: sessions/{uid} belongs to whoever is signed in as that uid (an anonymous
    // visitor, or a real account). Old club logins (fake emails) own nothing.
    function isClub(sessionId) {
      return request.auth != null && request.auth.uid == sessionId;
    }

    match /sessions/{sessionId} {
      allow read: if true;
      allow write: if isClub(sessionId);

      // Everything under a quick session is public to read, except leftover bookingRequests.
      match /{coll}/{docId} {
        allow read: if coll != 'bookingRequests' || isClub(sessionId);
        allow write: if isClub(sessionId);
      }
    }

    // ---- A real person: signed in with email or Google. Not an anonymous quick-session visitor,
    // and not an old club login (fake @courtflow.local email).
    function isRealUser() {
      return request.auth != null
        && request.auth.token.firebase.sign_in_provider != 'anonymous'
        && !request.auth.token.get('email', '').lower().matches('.*@courtflow[.]local');
    }

    // ---- Accounts: the person's own profile and their "My clubs" copies. Nobody else, ever.
    match /accounts/{uid} {
      allow read, write: if isRealUser() && request.auth.uid == uid;
      match /{document=**} {
        allow read, write: if isRealUser() && request.auth.uid == uid;
      }
    }

    // ---- Clubs. The member record is the single source of truth for who may do what.
    function clubPath(clubId) {
      return /databases/$(database)/documents/clubs/$(clubId);
    }
    function memberPath(clubId) {
      return /databases/$(database)/documents/clubs/$(clubId)/members/$(request.auth.uid);
    }
    function isMember(clubId) {
      return isRealUser() && exists(memberPath(clubId));
    }
    function memberRole(clubId) {
      return get(memberPath(clubId)).data.role;
    }
    function isManager(clubId) {
      return isMember(clubId) && memberRole(clubId) in ['owner', 'manager'];
    }
    function isOwner(clubId) {
      return isMember(clubId) && memberRole(clubId) == 'owner';
    }
    function isPublicClub(clubId) {
      return exists(clubPath(clubId)) && get(clubPath(clubId)).data.visibility == 'public';
    }
    // Public clubs show their open play to everyone; private clubs only to their members.
    function canSeeClub(clubId) {
      return isPublicClub(clubId) || isMember(clubId);
    }

    function validClub(d) {
      return d.name is string && d.name.size() > 0 && d.name.size() <= 60
        && d.visibility in ['public', 'private']
        && d.ownerId is string
        && (!('description' in d) || (d.description is string && d.description.size() <= 500))
        && (!('location' in d) || (d.location is string && d.location.size() <= 100));
    }

    // A player's request to join an event. Players may not be signed in (public clubs), so this is
    // the one thing the public may create: a pending request with these fields only, for an event
    // that exists. seatId is the public id of the player's spot (the request id stays secret, so
    // the phone number can't be reached from the public attendee list). createdAt sets the place in
    // line, so it must be near the real time.
    function validEventRequest(clubId, eventId) {
      let d = request.resource.data;
      return d.keys().hasOnly(['name', 'contact', 'method', 'ref', 'seatId', 'status', 'createdAt'])
        && d.keys().hasAll(['name', 'contact', 'method', 'seatId', 'status', 'createdAt'])
        && d.name is string && d.name.size() > 0 && d.name.size() <= 60
        && d.contact is string && d.contact.size() > 0 && d.contact.size() <= 40
        && d.method in ['cash', 'online']
        && (!('ref' in d) || (d.ref is string && d.ref.size() <= 60))
        && d.seatId is string && d.seatId.size() > 0 && d.seatId.size() <= 60
        && d.status == 'pending'
        && d.createdAt is number
        && d.createdAt > request.time.toMillis() - 600000
        && d.createdAt < request.time.toMillis() + 600000
        && exists(/databases/$(database)/documents/clubs/$(clubId)/events/$(eventId));
    }

    match /clubs/{clubId} {
      // Public clubs: anyone. Any club: a signed-in person who has its address (the random id),
      // so an invite link can show what the club is. Only public clubs can be listed.
      allow get: if resource.data.visibility == 'public' || isRealUser();
      allow list: if resource.data.visibility == 'public';

      allow create: if isRealUser() && request.resource.data.ownerId == request.auth.uid
        && validClub(request.resource.data);
      // Managers edit content and settings; only the owner changes visibility; the owner never changes.
      allow update: if isManager(clubId) && validClub(request.resource.data)
        && request.resource.data.ownerId == resource.data.ownerId
        && (request.resource.data.visibility == resource.data.visibility || isOwner(clubId));
      allow delete: if isOwner(clubId);

      match /members/{uid} {
        // Your own record (to learn your role, even when you have none), or any record if you're a member.
        allow get: if isRealUser() && (request.auth.uid == uid || isMember(clubId));
        allow list: if isMember(clubId);
        // The owner's record, created in the same batch as the club (getAfter sees the new club).
        allow create: if isRealUser() && request.auth.uid == uid
          && request.resource.data.role == 'owner'
          && request.resource.data.keys().hasOnly(['role', 'name', 'joinedAt'])
          && getAfter(clubPath(clubId)).data.ownerId == request.auth.uid;
        // The owner removes other people's records; their own record only once the club is gone.
        allow delete: if (isOwner(clubId) && request.auth.uid != uid)
          || (isRealUser() && request.auth.uid == uid && !exists(clubPath(clubId)));
      }

      match /events/{eventId} {
        allow read: if canSeeClub(clubId);
        allow write: if isManager(clubId);

        match /requests/{requestId} {
          // The request id is a random UUID the player keeps, so a single get works as "my booking"
          // without exposing anyone else's request. Phone numbers: no public list.
          allow get: if canSeeClub(clubId);
          allow list: if isManager(clubId);
          allow create: if validEventRequest(clubId, eventId) && (isPublicClub(clubId) || isMember(clubId));
          allow update, delete: if isManager(clubId);
        }

        // Game data (players, courts, matchLog, costs): managers only until the Live Board decides what to show.
        match /{sub}/{docId} {
          allow read, write: if isManager(clubId);
        }
      }

      match /roster/{id} {
        allow read: if isMember(clubId);
        allow write: if isManager(clubId);
      }
      match /joinRequests/{id} {
        allow read, write: if isManager(clubId);
      }
      match /private/{id} {
        allow read, write: if isManager(clubId);
      }
    }
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:rules`
Expected: `rules: all assertions passed`, then `cascade:` fails or errors because the old cascade test uses the old layout. That is expected; Task 4 rewrites it. (If `rules:` does not print, read the first failing assertion and fix the rules or the test; never loosen a test to pass.)

- [ ] **Step 5: Correct the spec and commit**

In `docs/superpowers/specs/2026-10-08-clubs-design.md`, replace the bullet that starts `- **Events and everything under them:**` with:

```
- **Events:** `read` by anyone when the club is public, by members when private. `write` by managers. `requests`: a validated pending `create` by anyone for a public club's existing event (today's rule, unchanged shape); for a private club by members only; `get` of a single request by id; `list`, `update`, `delete` by managers. **Game data under an event** (`players`, `courts`, `matchLog`, `costs`) is managers-only, as decided in step 3a; read access opens when the Live Board needs it.
```

```bash
git add firestore.rules tests/rules.test.mjs docs/superpowers/specs/2026-10-08-clubs-design.md
git commit -m "feat: club rules (members, events, requests, roster) with a full role matrix" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Delete cascades for clubs and accounts

**Files:**
- Rewrite: `src/utils/accountData.js`, `tests/cascade.test.mjs`

**Interfaces:**
- Consumes: Task 3 rules. The functions must run as the club's owner.
- Produces: `EVENT_SUBCOLLECTIONS`, `CLUB_SUBCOLLECTIONS`, `deleteEventData(db, clubId, eventId)`, `deleteClubData(db, clubId, ownerId)`, `deleteAccountData(db, uid)`.

- [ ] **Step 1: Write the failing test**

Replace `tests/cascade.test.mjs` with:

```js
// Delete cascades for events, clubs and accounts. Run: npm run test:rules (needs Java and the Firebase CLI).
import assert from "node:assert";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { deleteAccountData, deleteClubData, deleteEventData } from "../src/utils/accountData.js";

const env = await initializeTestEnvironment({
  projectId: "cascade-test",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});
const count = async (path) => {
  let n;
  await env.withSecurityRulesDisabled(async (ctx) => { n = (await getDocs(collection(ctx.firestore(), path))).size; });
  return n;
};
const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const EVENT_SUBS = ["requests", "players", "courts", "matchLog", "costs"];

// A club with two events (every subcollection), a roster, a join request, an invite, an owner and a member.
const seedClub = async (db, id, ownerId) => {
  await setDoc(doc(db, `clubs/${id}`), { name: id, visibility: "public", ownerId, createdAt: 1 });
  await setDoc(doc(db, `clubs/${id}/members/${ownerId}`), { role: "owner", name: ownerId, joinedAt: 1 });
  await setDoc(doc(db, `clubs/${id}/members/helper`), { role: "member", name: "Helper", joinedAt: 1 });
  await setDoc(doc(db, `clubs/${id}/roster/r1`), { name: "Regular" });
  await setDoc(doc(db, `clubs/${id}/joinRequests/j1`), { name: "J" });
  await setDoc(doc(db, `clubs/${id}/private/invite`), { code: "X" });
  for (const e of ["e1", "e2"]) {
    await setDoc(doc(db, `clubs/${id}/events/${e}`), { title: e, attendees: [] });
    for (const sub of EVENT_SUBS) await setDoc(doc(db, `clubs/${id}/events/${e}/${sub}/x`), { n: 1 });
  }
};

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await seedClub(db, "c1", "u1");
  await seedClub(db, "c2", "u2"); // must never be touched
  await seedClub(db, "c3", "u3");
  await setDoc(doc(db, "accounts/u1"), { name: "One" });
  await setDoc(doc(db, "accounts/u1/memberships/c1"), { clubName: "c1", role: "owner", joinedAt: 1 });
  await setDoc(doc(db, "accounts/u1/memberships/c2"), { clubName: "c2", role: "member", joinedAt: 1 }); // belongs, doesn't own
  // Old data from before clubs, still under the account.
  await setDoc(doc(db, "accounts/u1/roster/old"), { name: "Old" });
  await setDoc(doc(db, "accounts/u1/events/oldEvent"), { title: "Old" });
  for (const sub of EVENT_SUBS) await setDoc(doc(db, `accounts/u1/events/oldEvent/${sub}/x`), { n: 1 });
  await setDoc(doc(db, "accounts/u2"), { name: "Two" });
});

// Deleting one event takes the doc and every subcollection, and leaves the other event alone.
await deleteEventData(real("u3"), "c3", "e1");
assert.equal(await count("clubs/c3/events"), 1);
for (const sub of EVENT_SUBS) {
  assert.equal(await count(`clubs/c3/events/e1/${sub}`), 0, `c3/e1/${sub} left behind`);
  assert.equal(await count(`clubs/c3/events/e2/${sub}`), 1, `c3/e2/${sub} was touched`);
}

// Review Focus 2: deleting a club, run as its owner, leaves nothing.
await deleteClubData(real("u3"), "c3", "u3");
for (const sub of ["events", "members", "roster", "joinRequests", "private"]) {
  assert.equal(await count(`clubs/c3/${sub}`), 0, `c3/${sub} left behind`);
}
for (const e of ["e1", "e2"]) {
  for (const sub of EVENT_SUBS) assert.equal(await count(`clubs/c3/events/${e}/${sub}`), 0, `c3/${e}/${sub} left behind`);
}
await env.withSecurityRulesDisabled(async (ctx) => {
  const clubs = await getDocs(collection(ctx.firestore(), "clubs"));
  assert.equal(clubs.docs.map((d) => d.id).sort().join(), "c1,c2"); // c3 is gone
});

// Deleting an account removes the clubs it owns, its copies, and the pre-club data; clubs it only belongs to stay.
await deleteAccountData(real("u1"), "u1");
for (const sub of ["events", "members", "roster", "joinRequests", "private"]) {
  assert.equal(await count(`clubs/c1/${sub}`), 0, `c1/${sub} left behind`);
}
for (const e of ["e1", "e2"]) {
  for (const sub of EVENT_SUBS) assert.equal(await count(`clubs/c1/events/${e}/${sub}`), 0, `c1/${e}/${sub} left behind`);
}
assert.equal(await count("accounts/u1/memberships"), 0);
assert.equal(await count("accounts/u1/roster"), 0);
assert.equal(await count("accounts/u1/events"), 0);
for (const sub of EVENT_SUBS) assert.equal(await count(`accounts/u1/events/oldEvent/${sub}`), 0, `legacy ${sub} left behind`);
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  assert.equal((await getDocs(collection(db, "accounts"))).docs.map((d) => d.id).join(), "u2");
  assert.equal((await getDocs(collection(db, "clubs"))).docs.map((d) => d.id).join(), "c2");
});
assert.equal(await count("clubs/c2/members"), 2);
assert.equal(await count("clubs/c2/events/e1/players"), 1);

console.log("cascade: ok");
await env.cleanup();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:rules`
Expected: `rules: all assertions passed`, then the cascade test FAILS with `SyntaxError` for the missing `deleteClubData` export.

- [ ] **Step 3: Implement**

Replace `src/utils/accountData.js` with:

```js
import { collection, deleteDoc, doc, getDocs, writeBatch } from "firebase/firestore";
import { wipeCollection } from "./wipe.js";

// Subcollections under each event: join requests, and the game's players, courts, matchLog
// and costs. Listed here so deleting an event, a club or an account never orphans any of them.
export const EVENT_SUBCOLLECTIONS = ["requests", "players", "courts", "matchLog", "costs"];

// Subcollections directly under a club (events have their own cascade; members are handled in order).
export const CLUB_SUBCOLLECTIONS = ["roster", "joinRequests", "private"];

// Deletes one event and everything under it. The event doc goes first, so the rules refuse any
// new join request at once (they check the event exists) and nothing can slip in while the
// subcollections are cleared, which then run in parallel.
export async function deleteEventData(db, clubId, eventId) {
  const ref = doc(db, "clubs", clubId, "events", eventId);
  await deleteDoc(ref);
  await Promise.all(EVENT_SUBCOLLECTIONS.map((name) => wipeCollection(db, collection(ref, name))));
}

// Deletes a club and everything in it. Run as the club's owner. The order matters for the rules:
// everything else first (the owner's member record is what grants the right to delete it), then
// the club doc, then the owner's own member record (allowed once the club is gone), then the
// owner's "My clubs" copy.
export async function deleteClubData(db, clubId, ownerId) {
  const ref = doc(db, "clubs", clubId);
  const events = await getDocs(collection(ref, "events"));
  await Promise.all(events.docs.map((e) => deleteEventData(db, clubId, e.id)));
  await Promise.all(CLUB_SUBCOLLECTIONS.map((name) => wipeCollection(db, collection(ref, name))));
  const members = await getDocs(collection(ref, "members"));
  const others = writeBatch(db);
  members.docs.filter((m) => m.id !== ownerId).forEach((m) => others.delete(m.ref));
  await others.commit();
  await deleteDoc(ref);
  await deleteDoc(doc(ref, "members", ownerId));
  await deleteDoc(doc(db, "accounts", ownerId, "memberships", clubId));
}

// Events and roster that older versions kept directly under an account.
async function deleteLegacyData(db, uid) {
  const events = await getDocs(collection(db, "accounts", uid, "events"));
  await Promise.all(events.docs.map(async (e) => {
    await deleteDoc(e.ref);
    await Promise.all(EVENT_SUBCOLLECTIONS.map((name) => wipeCollection(db, collection(e.ref, name))));
  }));
  await wipeCollection(db, collection(db, "accounts", uid, "roster"));
}

// Erases everything an account owns: each club it owns (with everything in it), its "My clubs"
// copies, any data from before clubs, and the account doc itself. Data first; the caller deletes
// the sign-in last. Clubs the person only belongs to are left as they are (a later part adds leaving).
export async function deleteAccountData(db, uid) {
  const memberships = await getDocs(collection(db, "accounts", uid, "memberships"));
  const owned = memberships.docs.filter((m) => m.data().role === "owner");
  await Promise.all(owned.map((m) => deleteClubData(db, m.id, uid)));
  await wipeCollection(db, collection(db, "accounts", uid, "memberships"));
  await deleteLegacyData(db, uid);
  const batch = writeBatch(db);
  batch.delete(doc(db, "accounts", uid));
  await batch.commit();
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:rules`
Expected: `rules: all assertions passed`, `cascade: ok`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/accountData.js tests/cascade.test.mjs
git commit -m "feat: delete cascades for events, clubs and accounts on the club layout" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Hooks on clubs, and the new club hooks

**Files:**
- Modify: `src/hooks/useEvents.js`, `src/hooks/useEventPlayers.js`, `src/hooks/useEventActions.js`, `src/hooks/useGameActions.js`, `src/hooks/useAccount.js`
- Create: `src/hooks/useClubDoc.js`, `src/hooks/useMyClubs.js`, `src/hooks/useClubActions.js`

**Interfaces:**
- Consumes: Task 2 (`permissions`, `newClubDoc`, `membershipCopy`, `validateClubInput`, `eventBase`), Task 4 (`deleteClubData`).
- Produces:
  - The four event hooks take `clubId` where they took `uid` (`useEvents(clubId)`, `useEventRequests(clubId, ids)`, `useEventPlayers(clubId, eventId)`, `useEventActions({ clubId, events, hostName, timeZone, notify })`, `useGameActions({ clubId, club, hostName, timeZone, notify })`).
  - `useClubDoc(uid, clubId): { club, member, status: "loading" | "ready" | "missing", role, isMember, canManage, isOwner }`.
  - `useMyClubs(uid): { clubs: [{ id, clubName, role, joinedAt }], ready }`.
  - `useClubActions({ uid, name, notify }): { createClub(input): Promise<{ id } | { error }>, updateClub(clubId, patch), deleteClub(clubId) }`.
  - `useAccount().signUp(name, email, password)`; account docs hold `name` (existing docs with `clubName` still read as the name through `account.name || account.clubName`).

No unit test: Firestore wiring, covered by Tasks 3 and 4 (rules, cascade) and by the browser steps in Task 8.

- [ ] **Step 1: Move the four event hooks to `clubs/`**

Write this script to a file `scratchpad/edit-hooks.cjs` (use your scratchpad directory) and run it with `node`:

```js
const fs = require("fs");
const root = process.cwd() + "/";
function edit(f, pairs) {
  let s = fs.readFileSync(root + f, "utf8");
  const crlf = s.includes("\r\n");
  s = s.split("\r\n").join("\n");
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(f + " missing: " + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(root + f, crlf ? s.split("\n").join("\r\n") : s);
}
// In these files `uid` is only ever the identifier of the host, and "accounts" only the old path.
for (const f of ["src/hooks/useEvents.js", "src/hooks/useEventPlayers.js", "src/hooks/useEventActions.js", "src/hooks/useGameActions.js"]) {
  edit(f, [["uid", "clubId"], ['"accounts"', '"clubs"']]);
}
edit("src/hooks/useGameActions.js", [
  ["{ clubId, account, hostName, timeZone, notify }", "{ clubId, club, hostName, timeZone, notify }"],
  ["const acct = account || {};", "const acct = club || {};"],
]);
console.log("hooks moved to clubs");
```

Run: `node <scratchpad>/edit-hooks.cjs`, then `grep -n 'uid\|"accounts"' src/hooks/useEvents.js src/hooks/useEventPlayers.js src/hooks/useEventActions.js src/hooks/useGameActions.js`
Expected: no output. Also update the comment in `useEventActions.js` that says "The signed-in account owns all of these" to "The club's managers may make all of these".

- [ ] **Step 2: The profile name**

In `src/hooks/useAccount.js` apply these exact replacements (plain strings):
- `async function ensureAccount(user, clubName) {` → `async function ensureAccount(user, name) {`
- `await setDoc(ref, { clubName: clubName || defaultClubName(user), email: user.email, createdAt: Date.now() });` → `await setDoc(ref, { name: name || defaultClubName(user), email: user.email, createdAt: Date.now() });`
- `const signUp = (clubName, email, password) => {` → `const signUp = (name, email, password) => {`
- `await ensureAccount(u, clubName.trim()).catch(() => setFailed(true));` → `await ensureAccount(u, name.trim()).catch(() => setFailed(true));`
- the comment `// Creates accounts/{uid} once.` stays.

- [ ] **Step 3: New hooks**

Create `src/hooks/useClubDoc.js`:

```js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { permissions } from "../utils/clubs";

// The open club and what this person may do in it. The member record is the single source of
// truth for the role. `status` is "missing" when the club can't be read or doesn't exist, so a
// club that was deleted while open (or a private club the person isn't in) never shows a blank page.
export function useClubDoc(uid, clubId) {
  const [state, setState] = useState({ club: null, member: null, status: "loading" });
  useEffect(() => {
    setState({ club: null, member: null, status: "loading" });
    if (!firebaseConfigured || !uid || !clubId) return;
    let club = null;
    let member = null;
    let clubDone = false;
    let memberDone = false;
    const publish = () => {
      if (clubDone && memberDone) setState({ club, member, status: club ? "ready" : "missing" });
    };
    const unsubClub = onSnapshot(
      doc(db, "clubs", clubId),
      (s) => { club = s.exists() ? { id: s.id, ...s.data() } : null; clubDone = true; publish(); },
      () => { club = null; clubDone = true; publish(); },
    );
    const unsubMember = onSnapshot(
      doc(db, "clubs", clubId, "members", uid),
      (s) => { member = s.exists() ? s.data() : null; memberDone = true; publish(); },
      () => { member = null; memberDone = true; publish(); },
    );
    return () => { unsubClub(); unsubMember(); };
  }, [uid, clubId]);
  const role = state.member?.role || null;
  return { ...state, role, ...permissions(role) };
}
```

Create `src/hooks/useMyClubs.js`:

```js
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// The clubs this person belongs to, from the small copies under their account (no index needed).
// The real permission is always the club's own member record, so a stale copy can only show a
// name; opening it checks the club itself.
export function useMyClubs(uid) {
  const [state, setState] = useState({ clubs: [], ready: false });
  useEffect(() => {
    setState({ clubs: [], ready: false });
    if (!firebaseConfigured || !uid) return;
    return onSnapshot(
      collection(db, "accounts", uid, "memberships"),
      (s) => setState({
        clubs: s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.clubName || "").localeCompare(b.clubName || "")),
        ready: true,
      }),
      () => setState({ clubs: [], ready: true }),
    );
  }, [uid]);
  return state;
}
```

Create `src/hooks/useClubActions.js`:

```js
import { collection, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { membershipCopy, newClubDoc, validateClubInput } from "../utils/clubs";
import { deleteClubData } from "../utils/accountData";

// Writes for clubs. The signed-in person is the owner of what they create.
export function useClubActions({ uid, name, notify }) {
  // One batch: the club, the owner's member record and the owner's "My clubs" copy, or nothing.
  // Resolves to { id } or { error } (a message for the form).
  const createClub = async (input) => {
    const error = validateClubInput(input);
    if (error) return { error };
    const now = Date.now();
    const ref = doc(collection(db, "clubs"));
    const club = newClubDoc(input, uid, now);
    try {
      const batch = writeBatch(db);
      batch.set(ref, club);
      batch.set(doc(ref, "members", uid), { role: "owner", name: name || "Owner", joinedAt: now });
      batch.set(doc(db, "accounts", uid, "memberships", ref.id), membershipCopy(club, "owner", now));
      await batch.commit();
      return { id: ref.id };
    } catch {
      return { error: "Couldn't create the club. Check your connection and try again." };
    }
  };

  // `patch` holds club fields (name, description, location, visibility, defaults, rules, ...).
  // A new name also updates the search copy and this person's "My clubs" copy.
  const updateClub = async (clubId, patch) => {
    const next = { ...patch };
    if (typeof next.name === "string") next.nameLower = next.name.trim().toLowerCase();
    await updateDoc(doc(db, "clubs", clubId), next);
    if (typeof next.name === "string") {
      try {
        await updateDoc(doc(db, "accounts", uid, "memberships", clubId), { clubName: next.name.trim() });
      } catch { /* this person has no copy of the club yet (a later part adds them); the club itself saved */ }
    }
  };

  const deleteClub = async (clubId) => {
    await deleteClubData(db, clubId, uid);
    notify("Club deleted.");
  };

  return { createClub, updateClub, deleteClub };
}
```

- [ ] **Step 4: Verify**

Run: `npx vite build`
Expected: success (the app is not yet wired to the new hooks; nothing imports them). Then `git checkout -- dist && git clean -fdq dist`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useEvents.js src/hooks/useEventPlayers.js src/hooks/useEventActions.js src/hooks/useGameActions.js src/hooks/useAccount.js src/hooks/useClubDoc.js src/hooks/useMyClubs.js src/hooks/useClubActions.js
git commit -m "feat: event hooks read and write under clubs; club, my-clubs and club-action hooks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The club area (open play, event page, game)

**Files:**
- Create: `src/ClubApp.jsx`, `src/views/ClubHome.jsx`
- Modify: `src/views/Host.jsx`, `src/views/EventPage.jsx`, `src/Game.jsx`, `src/clubs.css`

**Interfaces:**
- Consumes: Tasks 2 and 5.
- Produces: `<ClubApp acct clubId route eventId navigate />` (renders the club shell and the screens `club`, `club-host`, `club-event`, `club-game`, and `club-settings` once Task 7 adds it); `<ClubHome club role canManage events fallbackZone base navigate />`; `<Host ... base />`, `<EventPage ... base />`, `<Game clubId club event ready base navigate endGame />` use `base = /clubs/{clubId}` for every link.

- [ ] **Step 1: Make links club-relative**

Write `scratchpad/edit-links.cjs`:

```js
const fs = require("fs");
const root = process.cwd() + "/";
function edit(f, pairs) {
  let s = fs.readFileSync(root + f, "utf8");
  const crlf = s.includes("\r\n");
  s = s.split("\r\n").join("\n");
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(f + " missing: " + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(root + f, crlf ? s.split("\n").join("\r\n") : s);
}

edit("src/views/Host.jsx", [
  ["function EventRow({ e, pending, navigate }) {", "function EventRow({ e, pending, navigate, base }) {"],
  ["const to = `/event/${e.id}`;", "const to = `${base}/event/${e.id}`;"],
  ["export default function Host({ events, requestsByEvent, fallbackZone, onNew, onPlayNow, onShare, navigate }) {", "export default function Host({ events, requestsByEvent, fallbackZone, onNew, onPlayNow, onShare, navigate, base }) {"],
  ["<EventRow key={e.id} e={e} pending={pendingOf(e)} navigate={navigate} />", "<EventRow key={e.id} e={e} pending={pendingOf(e)} navigate={navigate} base={base} />"],
]);

edit("src/views/EventPage.jsx", [
  ["  event, requests, actions, ready, gamePlayers, gameLoaded, onEdit, onShare, onPickPlayers, onOpenGame, onReopen, navigate,\n}) {", "  event, requests, actions, ready, gamePlayers, gameLoaded, onEdit, onShare, onPickPlayers, onOpenGame, onReopen, navigate, base,\n}) {"],
  ['navigate("/host")', "navigate(`${base}/host`)"],
  ['href="/host"', "href={`${base}/host`}"],
]);

edit("src/Game.jsx", [
  ["export default function Game({ uid, account, event, ready, navigate, endGame }) {", "export default function Game({ clubId, club, event, ready, base, navigate, endGame }) {"],
  ['to="/host"', "to={`${base}/host`}"],
  ["const eventPage = `/event/${event.id}`;", "const eventPage = `${base}/event/${event.id}`;"],
  ["base={eventBase(uid, event.id)}", "base={eventBase(clubId, event.id)}"],
  ["deriveSession={(raw) => buildGameSession(account, raw)}", "deriveSession={(raw) => buildGameSession(club, raw)}"],
  ["// /event/:id/game: the queue app on one event. The event doc is the session; the account's\n// settings", "// /clubs/:id/event/:eventId/game: the queue app on one event. The event doc is the session; the club's\n// settings"],
]);
console.log("links made club-relative");
```

Run it, then: `grep -n '"/host"\|`/event\|navigate("/' src/views/Host.jsx src/views/EventPage.jsx src/Game.jsx`
Expected: no output.

- [ ] **Step 2: The club overview**

Create `src/views/ClubHome.jsx`:

```jsx
import { CalendarDays, MapPin, Settings as SettingsIcon } from "lucide-react";
import DateTile from "../components/DateTile";
import { byStart, endHM, isListed } from "../utils/bookings";
import { formatHM, money } from "../utils/format";

const ROLE_LABEL = { owner: "Owner", manager: "Manager", member: "Member" };

// The club page: what the club is and its upcoming open play. Managers also get links into the
// management screens (the same links are in the club header).
export default function ClubHome({ club, role, canManage, events, fallbackZone, base, navigate }) {
  const upcoming = events.filter((e) => isListed(e, fallbackZone)).sort(byStart);
  const go = (to) => (ev) => { ev.preventDefault(); navigate(to); };
  return (
    <>
      <div className="club-title">
        <h1>{club.name}</h1>
        <div className="club-meta">
          {role && <span className="pill">{ROLE_LABEL[role]}</span>}
          <span className="pill off">{club.visibility === "public" ? "Public club" : "Private club"}</span>
          {club.location && <span className="club-location"><MapPin size={13} /> {club.location}</span>}
        </div>
        {club.description && <p className="club-about">{club.description}</p>}
      </div>

      {canManage && (
        <div className="club-actions">
          <a className="primary" href={`${base}/host`} onClick={go(`${base}/host`)}><CalendarDays size={15} /> Open play</a>
          <a className="outline" href={`${base}/settings`} onClick={go(`${base}/settings`)}><SettingsIcon size={15} /> Settings</a>
        </div>
      )}

      <div className="panel">
        <h3 className="club-section">Upcoming open play</h3>
        {upcoming.map((e) => {
          const row = (
            <>
              <DateTile date={e.date} />
              <div className="booking-main">
                <b>{e.title}</b>
                <small>
                  {formatHM(e.startTime)} – {formatHM(endHM(e))}
                  {e.level && e.level !== "Any Level" ? ` · ${e.level}` : ""}
                  {e.fee ? ` · ${money(e.fee)}` : " · Free"}
                </small>
              </div>
            </>
          );
          return canManage ? (
            <a key={e.id} className="booking-head event-row" href={`${base}/event/${e.id}`} onClick={go(`${base}/event/${e.id}`)}>{row}</a>
          ) : (
            <div key={e.id} className="booking-head">{row}</div>
          );
        })}
        {!upcoming.length && <div className="empty">No open play scheduled yet.</div>}
      </div>
    </>
  );
}
```

- [ ] **Step 3: The club shell**

Create `src/ClubApp.jsx`:

```jsx
import { Suspense, lazy, useRef, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { useClubDoc } from "./hooks/useClubDoc";
import { useClubActions } from "./hooks/useClubActions";
import { useEvents, useEventRequests } from "./hooks/useEvents";
import { useEventActions } from "./hooks/useEventActions";
import { useEventPlayers } from "./hooks/useEventPlayers";
import { useGameActions } from "./hooks/useGameActions";
import { applyDisplayPrefs } from "./utils/format";
import { applyTheme } from "./utils/theme";
import { isOver } from "./utils/bookings";
import { clubPath } from "./utils/clubs";
import { DEFAULT_DISPLAY } from "./data/constants";
import ClubHome from "./views/ClubHome";
import ClubSettings from "./views/ClubSettings";
import Host from "./views/Host";
import EventPage from "./views/EventPage";
import BookingModal from "./components/BookingModal";
import ShareModal from "./components/ShareModal";
import GamePickModal from "./components/GamePickModal";
import Toast from "./components/Toast";

// The queue app only loads when a game opens.
const Game = lazy(() => import("./Game"));

const Loading = () => <div className="loading"><span className="spinner" />Loading…</div>;

// Shown in place of a screen the person's role doesn't allow (Review Focus 3): no controls at all.
function ManagersOnly({ base, navigate }) {
  return (
    <div className="panel">
      <div className="empty">This page is for the club's managers.</div>
      <a className="outline back-link" href={base} onClick={(e) => { e.preventDefault(); navigate(base); }}>
        <ArrowLeft size={14} /> Back to the club
      </a>
    </div>
  );
}

// Everything under /clubs/:id. It loads the club and this person's role, applies the club's theme
// and time zone, and routes to the screens. Managers get the open play and settings screens.
export default function ClubApp({ acct, clubId, route, eventId, navigate }) {
  const uid = acct.user.uid;
  const info = useClubDoc(uid, clubId);
  const { club, role, canManage, isOwner } = info;
  const ready = info.status === "ready";
  const base = clubPath(clubId);

  const [eventModal, setEventModal] = useState(null); // null | "new" | an event being edited
  const [showShare, setShowShare] = useState(false);
  const [gamePick, setGamePick] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = (message, ms = 2200) => {
    clearTimeout(toastTimer.current);
    setToast({ message, action: null });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const dismissToast = () => { clearTimeout(toastTimer.current); setToast(null); };

  const display = { ...DEFAULT_DISPLAY, ...club?.display };
  const fallbackZone = display.timeZone;
  const { events, fromServer: eventsReady } = useEvents(ready ? clubId : null);
  // Listen for requests only on events still on the calendar (and the one open on screen), and only for managers.
  const watched = canManage ? events.filter((e) => !isOver(e, fallbackZone) || e.id === eventId).map((e) => e.id) : [];
  const requestsByEvent = useEventRequests(ready ? clubId : null, watched);
  const { players: gamePlayers, loaded: gameLoaded } = useEventPlayers(ready && canManage ? clubId : null, route === "club-event" ? eventId : null);

  const hostName = club?.name || "";
  const actions = useEventActions({ clubId, events, hostName, timeZone: display.timeZone, notify });
  const gameActions = useGameActions({ clubId, club, hostName, timeZone: display.timeZone, notify });
  const clubActions = useClubActions({ uid, name: acct.account?.name || acct.account?.clubName, notify });
  const openEvent = events.find((e) => e.id === eventId);
  const latestPayInfo = [...events].filter((e) => !e.walkIn).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]?.payInfo;
  const todayYmd = new Intl.DateTimeFormat("en-CA", { timeZone: display.timeZone }).format(new Date());

  const playNow = async () => {
    try {
      navigate(`${base}/event/${await gameActions.playNow()}/game`);
    } catch {
      notify("Couldn't start a game. Check your connection and try again.", 4000);
    }
  };
  const endGame = async (id) => {
    navigate(`${base}/event/${id}`);
    try {
      await gameActions.endGame(id);
    } catch {
      notify("Couldn't end the game. Try again from the event page.", 4000);
    }
  };
  const reopenGame = async (id) => {
    try {
      await gameActions.reopenGame(id);
    } catch {
      notify("Couldn't reopen the game. Check your connection and try again.", 4000);
    }
  };

  applyDisplayPrefs(display);
  // The club's colors apply inside the club; persist: false keeps the person's own theme cached for the hub.
  if (ready) applyTheme(display, { persist: false });

  const toHub = (e) => { e.preventDefault(); navigate("/"); };
  const go = (to) => (e) => { e.preventDefault(); navigate(to); };

  if (info.status === "loading") return <Loading />;
  if (!ready) {
    return (
      <div className="loading">
        Club not found. It may have been deleted, or it is a private club you haven't joined.
        <a className="outline back-link" href="/" onClick={toHub}><ArrowLeft size={14} /> My clubs</a>
      </div>
    );
  }

  if (route === "club-game") {
    // Only managers run games. Everyone else sees the same message as the other manager screens.
    if (!canManage) {
      return (
        <div className="acct-shell"><main className="acct-main"><ManagersOnly base={base} navigate={navigate} /></main></div>
      );
    }
    return (
      <Suspense fallback={<Loading />}>
        <Game
          clubId={clubId} club={club} event={events.find((e) => e.id === eventId)} ready={eventsReady}
          base={base} navigate={navigate} endGame={endGame}
        />
      </Suspense>
    );
  }

  const screen = () => {
    if (route === "club") {
      return <ClubHome club={club} role={role} canManage={canManage} events={events} fallbackZone={fallbackZone} base={base} navigate={navigate} />;
    }
    if (!canManage) return <ManagersOnly base={base} navigate={navigate} />;
    if (route === "club-host") {
      return (
        <Host
          events={events} requestsByEvent={requestsByEvent} fallbackZone={fallbackZone} base={base} navigate={navigate}
          onNew={() => setEventModal("new")} onPlayNow={playNow} onShare={() => setShowShare(true)}
        />
      );
    }
    if (route === "club-event") {
      return (
        <EventPage
          event={openEvent} requests={requestsByEvent[eventId] || []} actions={actions} ready={eventsReady}
          gamePlayers={gamePlayers} gameLoaded={gameLoaded} base={base} navigate={navigate}
          onPickPlayers={() => setGamePick(true)} onOpenGame={() => navigate(`${base}/event/${eventId}/game`)}
          onReopen={() => reopenGame(eventId)} onEdit={setEventModal} onShare={() => setShowShare(true)}
        />
      );
    }
    return (
      <ClubSettings
        club={club} isOwner={isOwner} notify={notify}
        onUpdate={(patch) => clubActions.updateClub(clubId, patch)}
        onDelete={async () => { await clubActions.deleteClub(clubId); navigate("/"); }}
      />
    );
  };

  const navClass = (...routes) => (routes.includes(route) ? "active" : "");

  return (
    <div className="acct-shell club-shell">
      <header className="acct-bar">
        <a className="acct-brand" href="/" onClick={toHub}>
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </a>
        <nav aria-label="Club">
          <a href={base} className={navClass("club")} onClick={go(base)}>{club.name}</a>
          {canManage && <a href={`${base}/host`} className={navClass("club-host", "club-event")} onClick={go(`${base}/host`)}>Open play</a>}
          {canManage && <a href={`${base}/settings`} className={navClass("club-settings")} onClick={go(`${base}/settings`)}>Settings</a>}
          <a href="/" onClick={toHub}>My clubs</a>
        </nav>
        <button className="outline" onClick={acct.signOutUser}><LogOut size={14} /> Sign out</button>
      </header>
      <main className="acct-main">{screen()}</main>
      {eventModal && (
        <BookingModal
          booking={eventModal === "new" ? null : eventModal} today={todayYmd} lastPayInfo={latestPayInfo}
          close={() => setEventModal(null)}
          submit={async (data) => {
            const id = await actions.save(eventModal === "new" ? null : eventModal.id, data);
            setEventModal(null);
            if (eventModal === "new") navigate(`${base}/event/${id}`);
          }}
        />
      )}
      {showShare && (
        <ShareModal
          url={`${window.location.origin}/open-play?club=${clubId}`} close={() => setShowShare(false)}
          title="Share your booking page" openLabel="Open booking page" qr
          hint={club.visibility === "public"
            ? "Players scan the code or open the link to see your upcoming open play and ask to join. You confirm each request on its event page."
            : "This club is private, so only signed-in members can book. Make the club public in Settings to let anyone book."}
        />
      )}
      {gamePick && openEvent && (
        <GamePickModal
          event={openEvent} players={gamePlayers} close={() => setGamePick(false)}
          submit={async (ids) => {
            const started = await gameActions.startGame(openEvent, ids);
            setGamePick(false);
            if (started) navigate(`${base}/event/${openEvent.id}/game`);
          }}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
```

`ClubSettings` is created in Task 7; until then this import fails the build, so create a one-line placeholder file now ONLY if you must run the build in this task: `src/views/ClubSettings.jsx` containing `export default function ClubSettings() { return null; }`. Task 7 overwrites it completely.

- [ ] **Step 4: Club shell styles**

Replace the contents of `src/clubs.css` with:

```css
/* Styles for clubs: the club shell, overview, create form and settings. Tokens only. */
.club-title h1{margin:0 0 6px;font:700 30px "Space Grotesk";letter-spacing:-.5px}
.club-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px}
.club-location{display:inline-flex;align-items:center;gap:4px;color:var(--muted);font-size:13px}
.club-about{margin:6px 0 16px;color:var(--ink-2);max-width:62ch;line-height:1.55}
.club-actions{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px}
.club-actions a{display:inline-flex;align-items:center;gap:6px;text-decoration:none}
.club-section{margin:0 0 6px;font:700 15px "Space Grotesk"}
.club-shell .acct-bar nav a:first-child{font-weight:800}
```

- [ ] **Step 5: Verify**

Run: `npx vite build`
Expected: success. Then `git checkout -- dist && git clean -fdq dist`.

- [ ] **Step 6: Commit**

```bash
git add src/ClubApp.jsx src/views/ClubHome.jsx src/views/ClubSettings.jsx src/views/Host.jsx src/views/EventPage.jsx src/Game.jsx src/clubs.css
git commit -m "feat: the club area (overview, open play, event page, game) with role guards" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hub, create club, club settings, profile

**Files:**
- Rewrite: `src/AccountApp.jsx`, `src/views/Hub.jsx`, `src/views/ClubSettings.jsx`
- Create: `src/views/CreateClub.jsx`, `src/views/Profile.jsx`, `src/components/ClubProfileSettings.jsx`
- Modify: `src/views/Settings.jsx`, `src/components/DeleteAccountDialog.jsx`, `src/components/AccountLogin.jsx`, `src/clubs.css`

**Interfaces:**
- Consumes: Tasks 2, 5 and 6.
- Produces: `<Hub name clubs ready navigate />`, `<CreateClub onCreate navigate />` (`onCreate(input) => Promise<{ id } | { error }>`), `<Profile acct ownedClubs onDelete />`, `<ClubSettings club isOwner notify onUpdate onDelete />`, `<ClubProfileSettings club isOwner onSave />`; `Settings` mode `club`; `export function SettingsRow`.

- [ ] **Step 1: Settings club mode**

Write `scratchpad/edit-settings.cjs`:

```js
const fs = require("fs");
const root = process.cwd() + "/";
function edit(f, pairs) {
  let s = fs.readFileSync(root + f, "utf8");
  const crlf = s.includes("\r\n");
  s = s.split("\r\n").join("\n");
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(f + " missing: " + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(root + f, crlf ? s.split("\n").join("\r\n") : s);
}

edit("src/views/Settings.jsx", [
  ["function SettingsRow(", "export function SettingsRow("],
  ['  mode = "club", canChangePassword = true,\n}) {\n  const isAccount = mode === "account";', '  mode = "club", canChangePassword = true, isOwner = false, onDeleteClub,\n}) {\n  const isClub = mode === "club"; // a club\'s settings page: no password rows, no Live Board (that is per event)'],
  ["isAccount", "isClub"],
  [`      <div className="account-group">
        <div className="eyebrow">Club</div>`, `      <div className="account-group" hidden={isClub}>
        <div className="eyebrow">Club</div>`],
  [`            body={isClub
              ? "Used to sign in to your account. Can't be looked up or displayed, only changed."
              : "Used to log back into this club. Can't be looked up or displayed, only changed."}`, `            body="Can't be looked up or displayed, only changed."`],
]);

// The Danger Zone: quick sessions erase, clubs delete (owner only).
const f = "src/views/Settings.jsx";
let s = fs.readFileSync(root + f, "utf8");
const crlf = s.includes("\r\n");
s = s.split("\r\n").join("\n");
const start = s.indexOf('      <div className="account-group">\n        <div className="eyebrow">Danger Zone</div>');
const end = s.indexOf("      {confirmNewLink && (");
if (start < 0 || end < 0 || end <= start) throw new Error("Danger Zone anchors not found");
const danger = `      <div className="account-group" hidden={isClub && !isOwner}>
        <div className="eyebrow">Danger Zone</div>
        <div className="panel account-panel account-danger">
          <SettingsRow
            title={isQuick ? "Erase this session" : "Delete club"}
            body={isQuick
              ? "Permanently deletes every player, court, match and cost in this quick session and starts a blank one. Cannot be undone."
              : "Permanently deletes this club with its open play, games, players and members. Cannot be undone."}
          >
            <button className="danger" onClick={isQuick ? onDeleteAccount : onDeleteClub}>
              <Trash2 size={14} /> {isQuick ? "Erase session" : "Delete club"}
            </button>
          </SettingsRow>
        </div>
      </div>

`;
s = s.slice(0, start) + danger + s.slice(end);
fs.writeFileSync(root + f, crlf ? s.split("\n").join("\r\n") : s);
console.log("settings edited");
```

Run it, then `grep -n "isAccount\|Delete Account" src/views/Settings.jsx`
Expected: no output.

- [ ] **Step 2: The delete dialog**

In `src/components/DeleteAccountDialog.jsx` change the signature and message. Replace
`export default function DeleteAccountDialog({ clubName, loading, onCancel, onConfirm, variant = "club", needsPassword = true }) {`
with
`export default function DeleteAccountDialog({ clubName, loading, onCancel, onConfirm, variant = "club", needsPassword = true, ownedClubs = [] }) {`
and replace the `<p>` message block (the ternary on `isAccount`) with:

```jsx
        <p>
          {isAccount
            ? ownedClubs.length
              ? `This permanently deletes your account and the ${ownedClubs.length === 1 ? "club" : "clubs"} you own (${ownedClubs.join(", ")}), with all their open play, games, players and members. There is no undo.`
              : "This permanently deletes your account. There is no undo."
            : "This permanently deletes the club with its open play, games, players and members. There is no undo."}
        </p>
```

- [ ] **Step 3: Club settings screens**

Create `src/components/ClubProfileSettings.jsx`:

```jsx
import { useState } from "react";
import { validateClubInput } from "../utils/clubs";
import { SettingsRow } from "../views/Settings";
import Select from "./Select";

const VISIBILITY = [
  { value: "public", label: "Public: listed, anyone can book" },
  { value: "private", label: "Private: members only" },
];

// The club's name, description, location and visibility. Managers edit the text; only the owner
// changes visibility (the rules enforce the same).
export default function ClubProfileSettings({ club, isOwner, onSave }) {
  const [form, setForm] = useState({
    name: club.name, description: club.description || "", location: club.location || "", visibility: club.visibility,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (change) => setForm((f) => ({ ...f, ...change }));
  const dirty = form.name !== club.name || form.description !== (club.description || "")
    || form.location !== (club.location || "") || form.visibility !== club.visibility;

  const save = async (e) => {
    e.preventDefault();
    const problem = validateClubInput(form);
    if (problem) return setError(problem);
    setError("");
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(), description: form.description.trim(), location: form.location.trim(),
        ...(isOwner ? { visibility: form.visibility } : {}),
      });
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    }
    setSaving(false);
  };

  return (
    <form className="account-group" onSubmit={save}>
      <div className="eyebrow">Club</div>
      <div className="panel account-panel">
        <SettingsRow title="Name" body="Shown on the club page, the booking page and open play.">
          <input className="club-input" value={form.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} aria-label="Club name" />
        </SettingsRow>
        <SettingsRow title="Description" body="A few lines for people visiting the club.">
          <textarea className="club-input" rows={3} value={form.description} maxLength={500} onChange={(e) => set({ description: e.target.value })} aria-label="Description" />
        </SettingsRow>
        <SettingsRow title="Location" body="Where you play, for example a city or venue.">
          <input className="club-input" value={form.location} maxLength={100} onChange={(e) => set({ location: e.target.value })} aria-label="Location" />
        </SettingsRow>
        <SettingsRow
          title="Visibility"
          body={isOwner ? "Public clubs can be found and their open play booked by anyone. Private clubs are for members only." : "Only the owner can change this."}
        >
          <div className="account-select">
            <Select value={form.visibility} onChange={(visibility) => isOwner && set({ visibility })} options={VISIBILITY} />
          </div>
        </SettingsRow>
        {error && <p className="op-error" role="alert">{error}</p>}
        <div className="club-save">
          <button className="primary" disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </form>
  );
}
```

Overwrite `src/views/ClubSettings.jsx`:

```jsx
import { useState } from "react";
import ClubProfileSettings from "../components/ClubProfileSettings";
import DeleteAccountDialog from "../components/DeleteAccountDialog";
import Settings from "./Settings";

// A club's settings: its profile, then the same session defaults, queue rules, cost defaults and
// display that used to live on the account. Every control saves straight to the club.
export default function ClubSettings({ club, isOwner, notify, onUpdate, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const save = async (patch) => { await onUpdate(patch); notify("Saved."); };
  const rules = { ...club.rules };
  const costDefaults = { ...club.costDefaults };
  const live = { ...club.live };
  const display = { ...club.display };

  return (
    <>
      <ClubProfileSettings club={club} isOwner={isOwner} onSave={save} />
      <Settings
        mode="club" isOwner={isOwner}
        session={{ location: club.name, defaults: club.defaults }}
        onSetDefaults={(defaults) => save({ defaults })}
        rules={rules} costDefaults={costDefaults} live={live} display={display}
        onSetRules={(change) => save({ rules: { ...rules, ...change } })}
        onSetCostDefaults={(change) => save({ costDefaults: { ...costDefaults, ...change } })}
        onSetLive={(change) => save({ live: { ...live, ...change } })}
        onSetDisplay={(change) => save({ display: { ...display, ...change } })}
        onDeleteClub={() => setConfirmDelete(true)}
      />
      {confirmDelete && (
        <DeleteAccountDialog
          variant="club" clubName={club.name} needsPassword={false} loading={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await onDelete();
              return "";
            } catch {
              setDeleting(false);
              return "Couldn't delete the club. Check your connection and try again.";
            }
          }}
        />
      )}
    </>
  );
}
```

(`Settings` already merges `DEFAULT_*` defaults for rules and the rest through its own props; a freshly created club stores full copies, so no further merging is needed.)

- [ ] **Step 4: Hub, create club, profile**

Replace `src/views/Hub.jsx` with:

```jsx
import { ListOrdered, Plus, UserRound, Users } from "lucide-react";

const ROLE_LABEL = { owner: "Owner", manager: "Manager", member: "Member" };

// The home screen: your clubs, creating one, your profile, and the quick session.
export default function Hub({ name, clubs, ready, navigate }) {
  const to = (path) => (e) => { e.preventDefault(); navigate(path); };
  return (
    <>
      <h1>{name ? `Hi, ${name}` : "Your clubs"}</h1>
      <p>Pick a club to manage or visit, or start one of your own.</p>

      <h2 className="club-section">My clubs</h2>
      <div className="hub-grid">
        {clubs.map((c) => (
          <a key={c.id} className="hub-card" href={`/clubs/${c.id}`} onClick={to(`/clubs/${c.id}`)}>
            <Users size={22} />
            <b>{c.clubName}</b>
            <span>{ROLE_LABEL[c.role] || "Member"}</span>
          </a>
        ))}
        <a className="hub-card" href="/clubs/new" onClick={to("/clubs/new")}>
          <Plus size={22} />
          <b>Create a club</b>
          <span>Start a club, then host open play and run games for it.</span>
        </a>
      </div>
      {ready && !clubs.length && <p className="hub-empty">You're not in any club yet. Create one to get started.</p>}

      <h2 className="club-section">Also</h2>
      <div className="hub-grid">
        <a className="hub-card" href="/settings" onClick={to("/settings")}>
          <UserRound size={22} />
          <b>Profile</b>
          <span>Your name, password and appearance.</span>
        </a>
        <a className="hub-card" href="/club">
          <ListOrdered size={22} />
          <b>Quick session</b>
          <span>Run the queue right now, no club needed. Saved on this device.</span>
        </a>
      </div>
    </>
  );
}
```

Create `src/views/CreateClub.jsx`:

```jsx
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import Select from "../components/Select";

const VISIBILITY = [
  { value: "public", label: "Public: listed, anyone can book" },
  { value: "private", label: "Private: members only" },
];

// The create-club form. onCreate resolves to { id } (go to the new club) or { error } (show it).
export default function CreateClub({ onCreate, navigate }) {
  const [form, setForm] = useState({ name: "", description: "", location: "", visibility: "public" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (change) => setForm((f) => ({ ...f, ...change }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await onCreate(form);
    if (result.error) {
      setError(result.error);
      setBusy(false);
    } else {
      navigate(`/clubs/${result.id}`);
    }
  };

  return (
    <>
      <a className="back-link" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}><ArrowLeft size={14} /> My clubs</a>
      <h1>Create a club</h1>
      <p>You'll be the owner. You can change everything later in the club's settings.</p>
      <form className="panel club-form" onSubmit={submit}>
        <label>
          Club name
          <input value={form.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Centro Pickle Club" autoFocus required />
        </label>
        <label>
          Description <small>(optional)</small>
          <textarea rows={3} value={form.description} maxLength={500} onChange={(e) => set({ description: e.target.value })} placeholder="Who plays, when, and at what level." />
        </label>
        <label>
          Location <small>(optional)</small>
          <input value={form.location} maxLength={100} onChange={(e) => set({ location: e.target.value })} placeholder="City or venue" />
        </label>
        <label>
          Who can see it
          <Select value={form.visibility} onChange={(visibility) => set({ visibility })} options={VISIBILITY} />
        </label>
        {error && <p className="op-error" role="alert">{error}</p>}
        <div className="modalactions">
          <button type="button" className="outline" onClick={() => navigate("/")}>Cancel</button>
          <button className="primary" disabled={busy || !form.name.trim()}>{busy ? "Creating…" : "Create club"}</button>
        </div>
      </form>
    </>
  );
}
```

Create `src/views/Profile.jsx`:

```jsx
import { useState } from "react";
import { Check, KeyRound, Pencil, Trash2, X } from "lucide-react";
import ChangePasswordDialog from "../components/ChangePasswordDialog";
import Select from "../components/Select";
import { SettingsRow } from "./Settings";

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match my device" },
];

// Your own profile: name, sign-in email, password, appearance, and deleting the account.
export default function Profile({ acct, onDelete }) {
  const account = acct.account;
  const name = account.name || account.clubName || "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [showPassword, setShowPassword] = useState(false);
  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) acct.updateAccount({ name: trimmed });
    setEditing(false);
  };

  return (
    <div className="account-groups">
      <div className="account-group">
        <div className="eyebrow">Profile</div>
        <div className="panel account-panel">
          <SettingsRow title="Name" body="Shown to the clubs you join and host.">
            {editing ? (
              <div className="account-edit">
                <input
                  value={draft} maxLength={60} autoFocus aria-label="Your name" onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                />
                <button className="icon" title="Save" onClick={save}><Check size={14} /></button>
                <button className="icon" title="Cancel" onClick={() => setEditing(false)}><X size={14} /></button>
              </div>
            ) : (
              <div className="account-edit">
                <b>{name}</b>
                <button className="icon" title="Rename" onClick={() => { setDraft(name); setEditing(true); }}><Pencil size={13} /></button>
              </div>
            )}
          </SettingsRow>
          <SettingsRow title="Email" body="What you sign in with.">
            <b>{account.email}</b>
          </SettingsRow>
          <SettingsRow hidden={!acct.hasPassword} title="Password" body="Can't be looked up or displayed, only changed.">
            <button className="outline" onClick={() => setShowPassword(true)}><KeyRound size={14} /> Change password</button>
          </SettingsRow>
          <SettingsRow title="Appearance" body="Light, dark, or follow your device. Clubs use their own colors inside the club.">
            <div className="account-select">
              <Select
                value={account.display?.theme || "light"}
                onChange={(theme) => acct.updateAccount({ display: { ...account.display, theme } })}
                options={THEMES}
              />
            </div>
          </SettingsRow>
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Danger zone</div>
        <div className="panel account-panel account-danger">
          <SettingsRow title="Delete account" body="Permanently deletes your account and the clubs you own. Cannot be undone.">
            <button className="danger" onClick={onDelete}><Trash2 size={14} /> Delete account</button>
          </SettingsRow>
        </div>
      </div>

      {showPassword && (
        <ChangePasswordDialog
          onCancel={() => setShowPassword(false)}
          onSubmit={async (current, next) => {
            const err = await acct.changePassword(current, next);
            if (!err) setShowPassword(false);
            return err;
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: The account shell**

Replace `src/AccountApp.jsx` with:

```jsx
import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useAccount } from "./hooks/useAccount";
import { useRoute } from "./hooks/useRoute";
import { useMyClubs } from "./hooks/useMyClubs";
import { useClubActions } from "./hooks/useClubActions";
import { applyTheme } from "./utils/theme";
import AccountLogin from "./components/AccountLogin";
import DeleteAccountDialog from "./components/DeleteAccountDialog";
import Toast from "./components/Toast";
import Hub from "./views/Hub";
import CreateClub from "./views/CreateClub";
import Profile from "./views/Profile";
import ClubApp from "./ClubApp";

// Sign-in, the hub, creating a club, and the profile. Everything under /clubs/:id is ClubApp.
export default function AccountApp() {
  const acct = useAccount();
  const { route, clubId, eventId, navigate } = useRoute();
  const uid = acct.user?.uid;
  const name = acct.account?.name || acct.account?.clubName || "";
  const { clubs, ready: clubsReady } = useMyClubs(uid);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const notify = (message, ms = 2200) => {
    clearTimeout(toastTimer.current);
    setToast({ message, action: null });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const dismissToast = () => { clearTimeout(toastTimer.current); setToast(null); };
  const clubActions = useClubActions({ uid, name, notify });

  // Success signs the user out (deleteUser). This shell stays mounted behind the
  // sign-in screen, so close the dialog or the next sign-in opens on it.
  const handleDelete = async (password) => {
    setDeleting(true);
    try {
      const err = await acct.deleteAccount(password);
      setDeleting(false);
      if (!err) setShowDelete(false);
      return err;
    } catch {
      setDeleting(false);
      return "Couldn't delete the account. Please try again.";
    }
  };

  // Not before the account loads: defaults would flash Light over the cached theme. Clubs apply their own colors inside ClubApp.
  if (acct.status === "in" && !clubId) applyTheme({ theme: acct.account.display?.theme || "light" });

  if (acct.status === "loading") {
    return <div className="loading"><span className="spinner" />Loading…</div>;
  }
  if (acct.status === "error") {
    return (
      <div className="loading">
        Couldn't load your account. Check your connection, then reload the page.
        <button className="outline" onClick={acct.signOutUser}><LogOut size={14} /> Sign out</button>
      </div>
    );
  }
  if (acct.status === "out") {
    return (
      <AccountLogin
        onSignIn={acct.signIn} onSignUp={acct.signUp} onGoogle={acct.signInGoogle} onReset={acct.resetPassword}
      />
    );
  }

  if (clubId && route.startsWith("club")) {
    return <ClubApp key={clubId} acct={acct} clubId={clubId} route={route} eventId={eventId} navigate={navigate} />;
  }

  const go = (to) => (e) => { e.preventDefault(); navigate(to); };
  const ownedNames = clubs.filter((c) => c.role === "owner").map((c) => c.clubName);

  return (
    <div className="acct-shell">
      <header className="acct-bar">
        <a className="acct-brand" href="/" onClick={go("/")}>
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </a>
        <nav aria-label="Account">
          <a href="/" className={route === "hub" || route === "clubs" ? "active" : ""} onClick={go("/")}>My clubs</a>
          <a href="/settings" className={route === "settings" ? "active" : ""} onClick={go("/settings")}>Profile</a>
        </nav>
        <button className="outline" onClick={acct.signOutUser}><LogOut size={14} /> Sign out</button>
      </header>
      <main className="acct-main">
        {route === "settings" ? (
          <Profile acct={acct} onDelete={() => setShowDelete(true)} />
        ) : route === "clubs-new" ? (
          <CreateClub onCreate={clubActions.createClub} navigate={navigate} />
        ) : (
          <Hub name={name} clubs={clubs} ready={clubsReady} navigate={navigate} />
        )}
      </main>
      {showDelete && (
        <DeleteAccountDialog
          variant="account" clubName={name} ownedClubs={ownedNames} needsPassword={acct.hasPassword} loading={deleting}
          onCancel={() => setShowDelete(false)} onConfirm={handleDelete}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
```

- [ ] **Step 6: Sign-up wording and styles**

In `src/components/AccountLogin.jsx` apply these plain-string replacements:
- `"One account for your club, your players and every open play."` → `"One account for the clubs you host and the clubs you join."`
- `Club or host name` → `Your name`
- `placeholder="e.g. Centro Pickle Club" autoComplete="organization" autoFocus` → `placeholder="e.g. Alex Santos" autoComplete="name" autoFocus`

Append to `src/clubs.css`:

```css
.hub-empty{margin:8px 0 0;color:var(--muted);font-size:13.5px}
.acct-main .club-section{margin:22px 0 10px}
.club-form{display:grid;gap:14px;max-width:560px}
.club-form label{display:grid;gap:6px;font-weight:700;font-size:13px}
.club-form small{color:var(--muted);font-weight:500}
.club-form input,.club-form textarea,.club-input{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink)}
.club-form textarea,textarea.club-input{resize:vertical}
.club-save{display:flex;justify-content:flex-end;padding:10px 4px 2px}
```

- [ ] **Step 7: Verify**

Run: `npx vite build`
Expected: success. Then `git checkout -- dist && git clean -fdq dist`.
Run: `grep -rn 'route === "host"\|route === "event"\|route === "game"' src` and confirm nothing reads the old route names.

- [ ] **Step 8: Commit**

```bash
git add src/AccountApp.jsx src/views/Hub.jsx src/views/ClubSettings.jsx src/views/CreateClub.jsx src/views/Profile.jsx src/components/ClubProfileSettings.jsx src/views/Settings.jsx src/components/DeleteAccountDialog.jsx src/components/AccountLogin.jsx src/clubs.css
git commit -m "feat: hub with My clubs, create club, club settings, profile" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The public booking page, docs, and the full check

**Files:**
- Modify: `src/OpenPlay.jsx`, `CLAUDE.md`

- [ ] **Step 1: Public booking page reads `?club=`**

Write `scratchpad/edit-openplay.cjs`:

```js
const fs = require("fs");
const root = process.cwd() + "/";
const f = "src/OpenPlay.jsx";
let s = fs.readFileSync(root + f, "utf8");
const crlf = s.includes("\r\n");
s = s.split("\r\n").join("\n");
const rep = (a, b) => {
  if (!s.includes(a)) throw new Error("missing: " + a.slice(0, 80));
  s = s.split(a).join(b);
};
rep("hostId", "clubId"); // the identifier of the club the page is for
rep('.get("host")', '.get("club")');
rep('"accounts", clubId', '"clubs", clubId');
rep("No host specified. Ask the host for their open play link.", "No club specified. Ask the club for its open play link.");
rep('import { doc, onSnapshot, setDoc } from "firebase/firestore";', 'import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";');
rep("  const { events, ready } = useEvents(clubId);\n", `  // Only public clubs have a public booking page. Anything else (a private club, a deleted one,
  // a made-up id) gets one calm message.
  const [access, setAccess] = useState("checking");
  useEffect(() => {
    if (!firebaseConfigured || !clubId) return;
    getDoc(doc(db, "clubs", clubId)).then(
      (s) => setAccess(s.exists() && s.data().visibility === "public" ? "open" : "closed"),
      () => setAccess("closed"),
    );
  }, [clubId]);
  const { events, ready } = useEvents(access === "open" ? clubId : null);
`);
rep('  if (!ready) return <div className="loading"><span className="spinner" />Loading open play…</div>;',
`  if (access === "closed") {
    return <div className="loading">This club's open play isn't public. If you're a member, sign in and open the club page.</div>;
  }
  if (access === "checking" || !ready) return <div className="loading"><span className="spinner" />Loading open play…</div>;`);
fs.writeFileSync(root + f, crlf ? s.split("\n").join("\r\n") : s);
console.log("open play edited");
```

Run it, then `grep -n 'accounts\|"host"\|hostId' src/OpenPlay.jsx`
Expected: no output. Check the hook order: `access`'s `useState`/`useEffect` run before the first early return (`if (!firebaseConfigured)`); if they landed after it, move them above.

- [ ] **Step 2: Document it**

In `CLAUDE.md`: run `grep -n "accounts/{uid}/events\|/host\|/event/\|open-play?host\|accounts/{uid}/roster" CLAUDE.md` and, for every hit, change the path to its club equivalent: `accounts/{uid}/events` becomes `clubs/{clubId}/events`, `/host` becomes `/clubs/:id/host`, `/event/:id` becomes `/clubs/:id/event/:eventId`, `/open-play?host={uid}` becomes `/open-play?club={clubId}`, and a roster under an account becomes `clubs/{clubId}/roster`. Then add this bullet after the "Accounts (step 1 ..." bullet:

```md
- Clubs (part A of `docs/superpowers/specs/2026-10-08-clubs-design.md`): people create clubs (`clubs/{id}`, public or private) and the club owns its settings, events, games and (later) roster; the account is only the person's profile (`accounts/{uid}`: name, email, `display.theme`, plus `memberships/{clubId}` copies that power "My clubs"). A person's role is the club's own `members/{uid}` record (`owner` / `manager` / `member`); `utils/clubs.js` holds the pure rules (`permissions`, `validateClubInput`, `newClubDoc`; check: `node src/utils/clubs.check.mjs`) and `firestore.rules` enforces the same table (public clubs: events readable and bookable by anyone; private: members only; game data under an event is managers-only). Routes: `/` hub, `/clubs/new`, `/clubs/:id`, `/clubs/:id/host`, `/clubs/:id/event/:eventId[/game]`, `/clubs/:id/settings`, `/settings` = profile; `/club` is still the quick session (route name `quick`). `AccountApp` is sign-in + hub + profile; `ClubApp` is everything under a club and applies the club's theme and time zone. Deleting a club or an account that owns clubs goes through `utils/accountData.js` (`deleteClubData`, `deleteAccountData`; test: `tests/cascade.test.mjs`). Parts B (joining: invite link, requests, directory) and C (managers) are specified but not built.
- Local emulators: `npm run emulators` (Auth + Firestore, project `demo-courtflow`) and `npm run dev:emu` (Vite on port 5300 pointed at them, `.env.emulator`): no real data, no published rules needed. Use them for browser checks.
```

Also replace any remaining sentence saying the quick session route is "club" with "quick".

- [ ] **Step 3: Run everything**

```bash
node src/utils/account.check.mjs && node src/utils/route.check.mjs && node src/utils/clubs.check.mjs && node src/utils/paths.check.mjs && node src/utils/bookings.check.mjs && node src/utils/gameSession.check.mjs && node src/utils/stats.check.mjs && node src/utils/theme.check.mjs && node src/utils/rotationModes.check.mjs && npm run test:rules && npx vite build
```

Expected: every `*.check` prints `ok`/`passed`, `rules: all assertions passed`, `cascade: ok`, and a successful build. Then `git checkout -- dist && git clean -fdq dist`.

- [ ] **Step 4: Browser pass on the emulators**

Run in the background: `npm run emulators`, wait for "All emulators ready", then `npm run dev:emu` and open `http://localhost:5300/`. Check, in order (use two browser contexts where a second person is needed):
1. Sign up as "Alex" (`alex@example.com`). Hub: "Hi, Alex", "My clubs" shows only "Create a club" and "You're not in any club yet", plus Profile and Quick session cards.
2. Create a club "Centro" (public, location "Manila", a description). You land on the club page with "Owner" and "Public club" pills, the description, an Open play and Settings link, and "No open play scheduled yet."
3. Open play: New open play (fee 150, 3 spots), add Ana, Ben, Cy, Dee (Dee on the waitlist), Proceed to game, tick two, start. The game opens under `/clubs/<id>/event/<id>/game` with the club name as the title. Check in, play a match, undo, End game: back on the event page; Reopen game.
4. Back on the hub: "Centro" is listed with "Owner". Create a second, private club "Hush": it is separate (no events from Centro).
5. Club Settings (Centro): change the description and name and save; the header shows the new name; the hub shows it too after a reload. Visibility select is enabled for the owner; switch Centro to private and back to public. Change a queue rule (Wins in a row before resting) and see it saved.
6. Sign out. In a signed-out window open `/open-play?club=<Centro id>`: the event shows; send a join request; as Alex it appears under Join requests on the event page. Open `/open-play?club=<Hush id>`: "This club's open play isn't public…".
7. Review Focus 3 and 5: signed in as a second person ("Sam", `sam@example.com`): open `/clubs/<Centro id>`: Centro's page shows (public club) with no Open play or Settings links; `/clubs/<Centro id>/host`, `/clubs/<Centro id>/settings` and `/clubs/<Centro id>/event/x/game` each show "This page is for the club's managers." with a back link and no controls. `/clubs/<Hush id>` (private, not a member) opens the club page (any signed-in person can open a private club by its address) showing only its name and description, "No open play scheduled yet.", and no controls. `/clubs/nope` shows "Club not found…" with a working "My clubs" link. Old bookmarks `/host` and `/event/abc` land on the hub.
8. Quick session: `/club` still works (add a player, check in, End Session goes to `/`).
9. Delete Hush from its Settings (type the name): you return to the hub and it is gone. Delete Alex's account from Profile (the dialog lists the club he owns): afterwards sign up as Alex again and confirm the hub is empty.
10. Browser console shows no errors throughout.

Stop the servers. Run `git clean -fdq .playwright-mcp; git checkout -- .playwright-mcp`.

- [ ] **Step 5: Commit**

```bash
git add src/OpenPlay.jsx CLAUDE.md
git commit -m "feat: public booking page reads ?club=; document clubs and the emulator workflow" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Publish note (do not run without approval)**

The new `firestore.rules` must be published in the Firebase console (Rules tab, Publish) before the deployed site can create clubs or take bookings; the old rules do not know `clubs`. Hosting needs a rebuild and `firebase deploy --only hosting` when you want it live.

---

## Self-review

**Spec coverage (part A):**
- Data model (`clubs`, `members`, `memberships`, events moved, account profile): Tasks 2, 3, 5, 7.
- Roles table and `permissions`: Task 2 (pure), Task 3 (rules), Task 6 (screens).
- Rules matrix for stranger, signed-out, anonymous quick user, legacy login, member, manager, owner on public and private clubs: Task 3.
- Create club in one batch with the owner's record and copy: Tasks 3 (rules), 5 (`createClub`), 7 (form).
- Screens: hub and My clubs, create, club page, host, event page, game, club settings, profile: Tasks 6 and 7. `/clubs` redirects to the hub (renders it). Public booking page `?club=`: Task 8.
- Theme and time zone inside a club; the personal theme on the hub: Tasks 6 and 7.
- Delete cascades for events, clubs and accounts with owned clubs and legacy data: Task 4. Delete club (owner) and Delete account with the owned-club list: Task 7.
- Old bookmarks land on the hub; quick session unchanged: Tasks 2 and 8.
- Emulator workflow so browser checks create no production data: Task 1.
- Spec correction (game data managers-only): Task 3.
- Parts B and C (joining, directory, managers) intentionally not built; the rules and data are ready for them.

**Placeholders:** none. Every code step has full code or exact replacement strings; browser checks list exact actions and outcomes. Two instructions ask the executor to read a file and apply a stated rule (`CLAUDE.md` path updates via grep; the `route.js` backslash check); both give the exact mapping.

**Type consistency:** `permissions(role)` returns `{ isMember, canManage, isOwner }`, used by `useClubDoc` (spread), `ClubApp` (`canManage`, `isOwner`) and `ClubHome`. `useClubActions` returns `{ createClub, updateClub, deleteClub }`; `createClub` resolves `{ id } | { error }` as `CreateClub` expects; `updateClub(clubId, patch)` and `deleteClub(clubId)` match `ClubSettings`' `onUpdate`/`onDelete` wiring in `ClubApp`. `eventBase(clubId, eventId)` (Task 2) is called by `Game.jsx` and `useGameActions` with a club id. `deleteEventData(db, clubId, eventId)`, `deleteClubData(db, clubId, ownerId)` and `deleteAccountData(db, uid)` match their callers (`useEventActions`, `useClubActions`, `useAccount`). `useRoute()` returns `{ route, clubId, eventId, navigate }`, consumed by `AccountApp` and passed to `ClubApp`. Route names in `route.js` (`club`, `club-host`, `club-event`, `club-game`, `club-settings`, `clubs`, `clubs-new`, `settings`, `quick`) match every comparison in `ClubApp` and `AccountApp`.

**Review Focus coverage:** 1 by the rules matrix (Task 3); 2 by `tests/cascade.test.mjs` (Task 4); 3 by `permissions` (Task 2) and browser step 7 (Task 8); 4 by the `isRealUser` cases (Task 3); 5 by `route.check.mjs` (Task 2) and browser step 7.
