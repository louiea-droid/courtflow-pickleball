# Monthly plan and 10-day trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock seven host tools behind a per-club monthly plan (₱299, admin-set), with a once-per-person 10-day trial, enforced in `firestore.rules`.

**Architecture:** Plan state lives where only admins write (`clubs/{id}/billing/plan`) or is checked at creation (`trials/{uid}`, copied onto the club as `trialUntil`). One rules function `planActive(clubId)` and its twin in `src/utils/plan.js` decide everything; a game started on the plan carries `planGame: true` and keeps its features until it ends. The app shows lock cards, an upgrade window, banners, a Plan tab and an `/admin` page.

**Tech Stack:** React (Vite), Firebase Auth + Firestore, `@firebase/rules-unit-testing`, plain-node `*.check.mjs` checks.

**Spec:** `docs/superpowers/specs/2026-11-17-monthly-plan-and-trial-design.md`

## Global Constraints

- Times are **milliseconds since epoch** (numbers), like the rest of the data (`createdAt`, `endedAt`). Rules compare with `request.time.toMillis()`.
- Trial = `10 * 86400000` ms (`TRIAL_MS`), once per person, starts when the person creates their first club, covers every club they own.
- Paid grace = `3 * 86400000` ms (`GRACE_MS`), paid periods only; the trial has none.
- Free clubs: `FREE_OPEN_PLAY = 4` bookable open play created per **UTC calendar month**; walk-ins (Play now) are unlimited.
- Price starts at `299` (₱) in `config/billing.price`; screens always read it, never hard-code it.
- Free forever (never locked): queue, booking page, waitlist, payment tracking, receipts, Call with the built-in voice, managers, club photo and cover, the whole quick session (`sessions/{uid}` rules unchanged).
- Locked on the club plan: Live Board, volunteer umpires, self check-in, recording own voice, Excel export (app only), **changing** club colors (`display.accent`, `display.team1`, `display.team2`), more than 4 open play a month.
- Nothing is ever deleted when a plan ends. Saved colors and recordings keep their effect as stored (colors keep showing).
- Lock cards say what the feature does, "Part of the monthly plan", the price, and an **Upgrade** button. Never a bare disabled button.
- Copy on locked public pages (Live Board, umpire, check-in): "This link isn't active, or this club's monthly plan has ended." (a refused read can't tell the two apart).
- Theme tokens only (no raw hex), styles in `src/clubs.css` for account/club screens and `src/styles.css` for the queue app; check at 390 px and desktop.
- Every rules change: add to `tests/plan.test.mjs`, run `npm run test:rules` (dev emulators stopped). The rules must be re-published in the Firebase console.

## Review Focus

1. **Rules read limits:** a Live Board / umpire / check-in phone reading players now also reads the event, billing doc and club doc. Firestore refuses a request past 10 document reads (20 in a batch). Expect every allowed path in `tests/plan.test.mjs` to still pass with all helpers in play (Task 2 step 1 covers the viewer reading `players` and `courts`, the umpire claiming a court in a batch, the check-in phone adding a player).
2. **Walk-in to bookable bypass:** a manager creates a free walk-in, then updates `walkIn` to false to dodge the open play counter. Expect the update refused unless the plan is active (Task 3).
3. **Trial reset:** an existing owner (trial doc already present) creates a new club and tries to create a fresh trial, or puts a later `trialUntil` on the club, or edits `trialUntil` later. Expect all refused (Task 1).
4. **Club delete after expiry:** the delete cascade must still work for a free club whose billing doc exists and whose `private/live` etc. remain. Expect `tests/cascade.test.mjs` to pass with a billing doc and usage doc seeded (Task 3).
5. **Clock at the boundary:** the app says "active" one second before the rules refuse. Any refused write of a locked feature shows the upgrade card / a toast, never a stuck spinner (Tasks 5 and 6 handle the `permission-denied` path).

---

### Task 1: Rules — admins, trials, billing, config, `planActive`, trial on club create

**Files:**
- Modify: `firestore.rules` (helpers near `isManager` ~line 278; `match /clubs/{clubId}` ~line 513; new top-level matches)
- Create: `tests/plan.test.mjs`
- Modify: `package.json` (`test:rules` gets `&& node tests/plan.test.mjs`)
- Modify existing tests' seeded clubs so they stay on the plan: add `trialUntil: Date.now() + 365 * 86400000` to every `clubs/*` doc seeded with rules disabled in `tests/*.test.mjs`; tests that create a club through the client also create `trials/{uid}` in the same batch.

**Interfaces:**
- Produces (rules): `isAdmin()`, `planActive(clubId)`; docs `admins/{uid}`, `trials/{uid} = { start, until }`, `clubs/{id}/billing/plan = { paidUntil, note, updatedAt, updatedBy }`, `config/billing = { price, gcashName, gcashNumber, contact }`, club field `trialUntil`.

- [ ] **Step 1: Write the failing tests** in `tests/plan.test.mjs` (same setup as `tests/clubPhoto.test.mjs`, `projectId: "plan-test"`; seed `admins/admin`):
  - `admins/{uid}`: own get succeeds, other's get fails, any client write fails.
  - `trials/{uid}`: own create `{ start: Date.now(), until: start + 864000000 }` succeeds; `until` one ms longer fails; start 1 h ago fails; creating for another uid fails (admin succeeds); update and delete by owner fail; own get succeeds, stranger get fails, admin get succeeds.
  - Club create: batch of trial + club with `trialUntil == trial.until` succeeds; club without `trialUntil` fails; `trialUntil` greater than the trial's fails; a person with an existing ended trial creating a club copying that `until` succeeds; that person creating a second `trials/{uid}` fails.
  - Club update: changing `trialUntil` fails for the owner.
  - `billing/plan`: manager get succeeds, member get fails, manager write fails, admin write `{ paidUntil, note, updatedAt, updatedBy }` succeeds.
  - `config/billing`: any real account reads, non-admin write fails, admin write succeeds.
  - Clubs list: admin lists all clubs (public and private); a stranger listing private clubs fails. Admin gets a private club's `members/{owner}`.
- [ ] **Step 2: Run** `npm run test:rules` (dev emulators stopped). Expected: `plan.test.mjs` fails.
- [ ] **Step 3: Implement the rules.**
  - `isAdmin()` = signed in and `exists(/admins/$(request.auth.uid))`.
  - `planActive(c)` = `get(clubPath(c)).data.get('trialUntil', 0) > now` **or** (`exists(billing)` and `get(billing).data.paidUntil + 259200000 > now`), where `now = request.time.toMillis()`.
  - `trials/{uid}`: get if own or admin; create if (own uid and `nearNow(start)`) or admin, keys exactly `start, until`, `until == start + 864000000` (admin may set any number for `until`); no update/delete (admin may update).
  - `clubs/{id}` create adds: `existsAfter(trials/{auth.uid})` and `request.resource.data.trialUntil == getAfter(trials/{auth.uid}).data.until`. Update adds: `trialUntil` unchanged. `list` adds `|| isAdmin()`. `members/{uid}` get adds `|| isAdmin()`.
  - `clubs/{id}/billing/{doc}`: get if `isManager(id) || isAdmin()`; write if `isAdmin()`; delete also if `isOwner(id) && !exists(clubPath(id))` (cascade, Task 3).
  - `config/billing`: read if `isRealUser()`; write if `isAdmin()`.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: all files pass (fix seeds in older tests per Files above).
- [ ] **Step 5: Commit** `feat(rules): admins, trials, billing and planActive`

### Task 2: Rules — lock Live Board, umpires, self check-in, voice, colors; `planGame`

**Files:**
- Modify: `firestore.rules` (`eventUmpire`, `eventCheckin`, `eventViewer` ~lines 314-390; event `{sub}/{docId}` wildcard ~line 611; `umpires`, `checkins`, `viewers` creates; `voice/{clipId}`; club update; event create/update)
- Test: `tests/plan.test.mjs`

**Interfaces:**
- Consumes: `planActive(c)` (Task 1).
- Produces: `gamePlan(c, e)` = `get(event).data.get('planGame', false) == true || planActive(c)`; event field `planGame` (bool).

- [ ] **Step 1: Write the failing tests** (seed club `free` with `trialUntil` in the past and no billing, club `paid` with billing `paidUntil` in the future, club `grace` with `paidUntil` 2 days ago, club `lapsed` with `paidUntil` 4 days ago; each with a live event `g`, its `private/live`, `private/umpire`, `private/checkin {on:true}`, a court and a player):
  - On `free` / `lapsed`: viewer create, umpire create, checkin create fail; manager `setDoc` of `private/live`, `private/umpire`, `private/checkin` fails; manager delete of `private/live` succeeds; manager `voice/x` create fails, delete succeeds; manager update of `display.team1` fails, of `display.timeZone` succeeds.
  - On `paid` and `grace`: all of the above succeed, and a registered viewer reads `players` and `courts`, an umpire claims a court in a batch and writes a score, a check-in phone adds a new player (read-limit check, Review Focus 1).
  - `planGame`: on `free`, an event with `planGame: true` (seeded with rules off) still lets a viewer register and read players; a manager setting `planGame: true` on `free` fails; setting `planGame: false` succeeds; on `paid` setting it true succeeds.
- [ ] **Step 2: Run** `npm run test:rules`. Expected: new cases fail.
- [ ] **Step 3: Implement.** Add `&& gamePlan(c, e)` to `eventUmpire`, `eventCheckin`, `eventViewer` and to the `umpires`, `checkins`, `viewers` create rules. Split the event wildcard: `allow delete: if isManager(clubId)`; `allow create, update: if isManager(clubId) && (!(sub == 'private' && docId in ['live', 'umpire', 'checkin']) || planActive(clubId))`. Voice: create/update additionally `planActive(clubId)`. Club update: if `display.accent`, `display.team1` or `display.team2` differ from `resource.data.display`, require `planActive(clubId)` (use `.get('display', {}).get(k, null)`). Event create/update: `planGame` may be `true` in the result only if it was already true or `planActive(clubId)`.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(rules): lock paid game features to the club plan`

### Task 3: Rules + data — open play counter, walk-in lock, delete cascade

**Files:**
- Modify: `firestore.rules` (event create/update; new `clubs/{id}/usage/{month}` match)
- Modify: `src/utils/accountData.js` (`deleteClubData`: after `deleteDoc(ref)`, delete `billing/plan` and wipe `usage`, before the owner's member record)
- Test: `tests/plan.test.mjs`, `tests/cascade.test.mjs`

**Interfaces:**
- Produces: `clubs/{id}/usage/{YYYY-MM}` = `{ n }` (UTC month of `request.time`).

- [ ] **Step 1: Write the failing tests:**
  - On `free`: a batch of a bookable event + `usage/{thisMonth}` from n=3 to n=4 succeeds; from 4 to 5 fails; an event without the counter write fails; writing the counter for a different month id fails; a walk-in event (`walkIn: true`) with no counter succeeds; updating that walk-in to `walkIn: false` fails (Review Focus 2); `usage` update by +2 fails; owner delete of `usage` while the club exists fails.
  - On `paid`: a bookable event with no counter write succeeds.
  - `cascade.test.mjs`: seed `billing/plan` and `usage/2026-11` on the deleted club; after `deleteClubData` both are gone (Review Focus 4).
- [ ] **Step 2: Run** `npm run test:rules`. Expected: fail.
- [ ] **Step 3: Implement.** Rules month id: `string(request.time.year()) + '-' + (request.time.month() < 10 ? '0' : '') + string(request.time.month())`. Event create when not a walk-in: `planActive(clubId) || (getAfter(usage/{month}).data.n == (exists(usage) ? get(usage).data.n : 0) + 1 && getAfter(...).data.n <= 4)`. Event update: changing `walkIn` requires `planActive(clubId)`. `usage/{month}`: read if manager; create/update if manager and `month` is the current month id and `n == old + 1` (old = 0 when missing) and keys only `n`; delete only `isOwner && !exists(clubPath)`.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: all pass.
- [ ] **Step 5: Commit** `feat(rules): 4 free open play a month, plan-safe club delete`

### Task 4: `src/utils/plan.js` — the same logic for the app

**Files:**
- Create: `src/utils/plan.js`, `src/utils/plan.check.mjs`

**Interfaces:**
- Produces:
  - `TRIAL_MS`, `GRACE_MS`, `FREE_OPEN_PLAY` (values in Global Constraints).
  - `usageMonth(now: number) -> "YYYY-MM"` (UTC).
  - `planState(club, billing, now) -> { active: boolean, kind: "trial" | "paid" | "free", until: number | null }` — `paid` when `billing.paidUntil + GRACE_MS > now`, else `trial` when `club.trialUntil > now`, else `free` (`until` = the latest end seen, or null).
  - `gameHasPlan(event, state) -> boolean` = `event.planGame === true || state.active`.
  - `planBanner(state, now) -> null | { kind: "ending", days: number } | { kind: "ended" }` — `ending` when `until - now` is within 3 days (days rounded up), `ended` when `kind === "free"` and `until` is set (had a trial or a paid period), null for a club that never had either.
  - `addMonth(fromMs: number) -> number` — same UTC day next month, clamped to the month's last day (Jan 31 → Feb 28/29).
  - `canCreateOpenPlay(state, usedThisMonth) -> boolean`.

- [ ] **Step 1: Write the failing check** `plan.check.mjs` with `node:assert`: paid beats an ended trial; 2-day-old `paidUntil` is still active (grace); 4-day-old is free; trial with 1 ms left is active, 0 ms is free; `usageMonth(Date.UTC(2026, 0, 31, 23, 59))` is `"2026-01"`; `addMonth(Date.UTC(2026,0,31))` equals `Date.UTC(2026,1,28)`; `planBanner` gives `{kind:"ending",days:3}` at 2.5 days left, `{kind:"ended"}` after, null for a club with no trial/billing; `canCreateOpenPlay(free, 4)` false, `(free, 3)` true, `(paid, 99)` true.
- [ ] **Step 2: Run** `node src/utils/plan.check.mjs`. Expected: fails (module missing).
- [ ] **Step 3: Implement** `src/utils/plan.js`.
- [ ] **Step 4: Run** `node src/utils/plan.check.mjs`. Expected: prints ok.
- [ ] **Step 5: Commit** `feat: plan state helpers`

### Task 5: Trial on first club, plan hooks, `planGame` and the counter in writes

**Files:**
- Modify: `src/hooks/useClubActions.js` (`createClub`), `src/hooks/useEventActions.js` (`save` create path), `src/hooks/useGameActions.js` (`startGame`, `playNow`, `reopenGame`), `src/ClubApp.jsx`, `src/views/Game.jsx`
- Create: `src/hooks/usePlan.js`

**Interfaces:**
- Consumes: Task 4 helpers; rules from Tasks 1-3.
- Produces: `useClubPlan(clubId, club, isManager) -> state` (reads `billing/plan` when manager; members get `planState(club, null, now)`); `usePlanConfig() -> { price, gcashName, gcashNumber, contact } | null` (one `getDoc` of `config/billing` per tab); `useUsage(clubId) -> number` (this month's `n`). `ClubApp` passes `plan` to its screens and to `Game.jsx`, which passes `plan` to `QueueApp` (quick session passes `{ active: true, kind: "paid", until: null }`).

- [ ] **Step 1:** `createClub`: `getDoc(trials/{uid})`; if missing, add `trials/{uid} = { start: now, until: now + TRIAL_MS }` to the batch; set `club.trialUntil` to that `until` (existing doc: its `until`).
- [ ] **Step 2:** event create (`save` without id, bookable): write the event and `usage/{usageMonth(now)}` `{ n: used + 1 }` in one batch (read the counter first). On refusal notify "You've used your 4 free open play this month. Upgrade for unlimited." and return without creating.
- [ ] **Step 3:** `startGame`, `playNow`, `reopenGame` write `planGame: plan.active` with the status change (reopen after the plan ended writes `false`).
- [ ] **Step 4: Verify** in the emulators (`npm run emulators` + `npm run dev:emu`): a new account creates a club → `trials/{uid}` and `club.trialUntil` exist; a second club copies the same `trialUntil`; a fifth open play on a club with an expired trial (set `trialUntil` in the past through the emulator UI) shows the message.
- [ ] **Step 5: Commit** `feat: start the trial with the first club, count open play`

### Task 6: Lock cards, upgrade window, banners, Plan tab

**Files:**
- Create: `src/components/PlanLock.jsx`, `src/components/UpgradeModal.jsx`, `src/components/PlanBanner.jsx`
- Modify: `src/components/LiveLinkModal.jsx` (both tabs), `src/components/UmpireModal.jsx`, `src/components/VoiceModal.jsx`, `src/views/Cost.jsx` + `src/views/EventPage.jsx` (Export), `src/components/CourtSettingsModal.jsx` + `src/views/Settings.jsx` (color swatches), `src/views/Host.jsx` / `src/views/ClubHome.jsx` (Start new when `!canCreateOpenPlay`), `src/views/ClubSettings.jsx` (new `plan` tab, `#plan`), `src/ClubApp.jsx` + `src/QueueApp.jsx` (banner), `src/clubs.css`, `src/styles.css`

**Interfaces:**
- Consumes: `plan` prop, `usePlanConfig`, `planBanner`, `gameHasPlan`, `canCreateOpenPlay`, `useUsage`.
- Produces: `<PlanLock feature="Live Board" what="Show the queue and scores on a TV at the venue." />` (renders the card and opens `UpgradeModal`); `<UpgradeModal close />` (price "₱{price} a month per club", GCash name and number, "Send your receipt to {contact}. We'll switch your club on within a day."); `<PlanBanner plan role />` (owner and managers only; dismissed per day in localStorage `courtflow.planBanner.{clubId}`).

- [ ] **Step 1:** Build the three components. Banner copy: ending trial "{n} days left of your free trial."; ending paid "Your plan ends on {formatDate(until)}."; ended "Your trial has ended." / "Your plan has ended." + " Upgrade to keep Live Board, umpires and more." with **Upgrade**.
- [ ] **Step 2:** Swap each locked action for `PlanLock` when `!gameHasPlan(event, plan)` (game features: Live Board, umpires, check-in) or `!plan.active` (voice, export, color swatches, Start new over the limit). Show "{used} of 4 free open play this month" next to Start new on a free club. A `permission-denied` from any locked write opens `UpgradeModal` (Review Focus 5).
- [ ] **Step 3:** Plan tab in club Settings: Free / Trial (ends {date}) / Monthly (until {date}), open play used this month on free, **Upgrade**.
- [ ] **Step 4: Verify** in the browser at 390 px and desktop, light and dark: a club on trial shows no locks and the 3-day banner when `trialUntil` is 2 days out; after setting it in the past, each of the seven features shows its card; a live game with `planGame: true` keeps its Live Board until **End game**.
- [ ] **Step 5: Commit** `feat: lock cards, upgrade window, plan banner and tab`

### Task 7: Locked public pages

**Files:**
- Modify: `src/LiveBoard.jsx`, `src/views/Umpire.jsx` (or `src/Umpire.jsx`, wherever the route renders), `src/views/Checkin.jsx`

- [ ] **Step 1:** Where each page currently handles a refused registration/read, show the Global Constraints copy ("This link isn't active, or this club's monthly plan has ended.").
- [ ] **Step 2: Verify** in the browser: open a game's Live Board, umpire and check-in links on a club whose trial is over and whose game has no `planGame`: each shows the message, no spinner.
- [ ] **Step 3: Commit** `feat: say when a link stops because of the plan`

### Task 8: Admin page and launch

**Files:**
- Create: `src/views/Admin.jsx`, `src/hooks/useIsAdmin.js`, `src/utils/adminData.js`
- Modify: `src/utils/route.js` (`/admin` → `"admin"`) + `src/utils/route.check.mjs`, `src/AccountApp.jsx` (render `Admin` for admins, else Home), `src/components/AccountMenu.jsx` (Admin entry when `useIsAdmin()`)

**Interfaces:**
- Produces: `useIsAdmin() -> boolean` (`getDoc(admins/{uid})`, once per tab); `adminData.js`: `setPaidUntil(clubId, ms, note, adminUid)`, `saveBillingConfig(cfg)`, `launchGrant(clubs, now, adminUid)` (batches of ≤ 450: for each club `billing/plan.paidUntil = now + 90 * 86400000`, and for each owner without a trial `trials/{ownerId} = { start: now - TRIAL_MS, until: now - 1 }` so they don't get a fresh trial on top).

- [ ] **Step 1: Add the failing route check** in `route.check.mjs`: `routeOf("/admin")` is `"admin"`. Run `node src/utils/route.check.mjs`, expect fail; implement; expect pass.
- [ ] **Step 2:** `Admin.jsx`: lists all clubs (one `getDocs(collection(db, "clubs"))`, limit 500; search on the device by name), each row: name, owner name (`members/{ownerId}.name`), trial end, paid until, **Add 1 month** (`addMonth(max(now, paidUntil))`), a date field + note + Save. A **Billing details** form for `config/billing` (price defaults to 299). A **Launch: 3 months free for every club** button with a confirm, which runs `launchGrant` and is hidden once `config/billing.launchedAt` is set (write it in the last batch; add `launchedAt` to the `config/billing` keys allowed in Task 1).
- [ ] **Step 3: Verify** in the emulators: create `admins/{uid}` for a demo account in the emulator UI, open `/admin`, add a month to a club, run Launch, confirm the club screens drop their locks and an owner's next club gets no fresh trial. A non-admin opening `/admin` lands on Home.
- [ ] **Step 4: Commit** `feat: admin page for plans and launch grant`

### Task 9: Landing page, docs, ship

**Files:**
- Modify: `src/landing/Landing.jsx` + `src/landing/landing.css` (Free / Monthly section; the "How much does it cost?" answer: "Free for players, always. Hosts get the standard tools free; the monthly plan (₱299 a club) adds Live Board, umpires, self check-in, your own voice, Excel export, club colors and unlimited open play. Every new host gets 10 days free."), `docs/business/2026-10-16-earning-plan.md` (Phase 2 table and "How we take the money" point to the spec; tick what shipped), `CLAUDE.md` (one Settings-backlog entry: monthly plan, files, checks, "the rules must be re-published")

- [ ] **Step 1:** Write the landing section and the docs entries. The landing page loads without Firebase (CLAUDE.md "Load speed"), so it states ₱299 as text; the CLAUDE.md entry notes it must be edited when the price changes.
- [ ] **Step 2: Verify** everything: `node src/utils/plan.check.mjs`, `node src/utils/route.check.mjs`, every other `src/utils/*.check.mjs`, `npm run test:rules`, `npm run build`. Expected: all pass.
- [ ] **Step 3: Commit** `docs: monthly plan on the landing page and in the docs`
- [ ] **Step 4 (owner, after merge):** in the Firebase console create `admins/{your uid}`; publish `firestore.rules`; deploy hosting; open `/admin`, fill Billing details, press Launch once.
