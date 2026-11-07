# Shared Up Next Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every manager of a game (and a quick session's owner on any device) sees and edits one live Up Next line, stored in Firestore instead of each browser's localStorage.

**Architecture:** The line lives in `{base}/private/upNext`. A hook (`useUpNext`) listens to it and exposes two writers: `changeUpNext(fn)` for line-only edits and `commitWithUpNext(change, addWrites, guard)` for writes that seat players and change the line together. Both run a Firestore transaction and fall back to a plain write when offline. Pure helpers (shape conversion, guarded edits, lock-in) live in `utils/upNextData.js` with a node check.

**Tech Stack:** React 19 + Vite, Firebase JS SDK (Firestore `onSnapshot`, `runTransaction`, `writeBatch`), `@firebase/rules-unit-testing`, Playwright CLI for the browser check.

**Spec:** `docs/superpowers/specs/2026-11-07-shared-up-next-design.md`

## Global Constraints

- Document path: `{base}/private/upNext` (`base` = `eventBase(clubId, eventId)` or `sessionBase(uid)`, the same array `QueueApp`'s `at()` uses).
- Shape on disk: `{ line: [{ seats: [id | null, ...] } | null, ...], own: { [courtId]: [id | null, ...] }, at: serverTimestamp() }`. In memory it stays today's `{ line: [ids | null], own: { courtId: ids } }` (`asDrafts`, `EMPTY_DRAFTS`).
- No change to `firestore.rules`. Nothing to re-publish.
- Live Board, `QueueView`, `ActiveQueue` and `utils/queueStatus.js` are not touched.
- Old localStorage key `cf-upnext-line:${base.join("/")}`: read once for the upload, then removed. No other localStorage use for Up Next.
- Offline means `navigator.onLine === false` or a Firestore error with `code` `unavailable` or `failed-precondition`.
- Theme tokens only for any new UI (there should be none beyond toasts). Match surrounding comment density and naming.
- Git author on this PC: `git -c user.name="Louiea" -c user.email="louiea@hyacinthindustriesllc.com" commit ...`, message ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Two managers press Send to Court (or Start Next Match) on the same match within a second: the group goes on one court only; the second device gets "That match already went on court." and nothing is written. Pinned in Task 3 (guard) and Task 5 (browser).
2. A swap or emptied seat made on a stale screen (another manager changed that match a moment earlier): the stale edit is refused with "Up Next changed on another device. Try again.", never silently overwriting. Pinned in Task 1 (`withEdits`) and Task 4.
3. The lock-in effect re-running on every render while its transaction is in flight: at most one lock-in transaction per device at a time, and no write when the slot is already filled in the saved line. Pinned in Task 1 (`lockInto` returns the same object) and Task 4 (in-flight ref).
4. Device offline while recording a win: the result and the line change still save (queued) and appear on the other device when it reconnects. Pinned in Task 3 (fallback) and Task 5 (offline step).
5. The line document doesn't exist yet, or a screen hasn't received its first snapshot: nothing is locked until the first snapshot; a local line from before this change is uploaded once, only if the document is still missing. Pinned in Task 3 (`loaded`, migration) and Task 5.

---

### Task 1: Pure helpers for the stored line

**Files:**
- Create: `src/utils/upNextData.js`
- Test: `src/utils/upNextData.check.mjs`

**Interfaces:**
- Consumes: `EMPTY_DRAFTS`, `asDrafts`, `draftAt`, `draftSeats`, `withDraft` from `src/utils/rotationModes.js`.
- Produces:
  - `toDoc(drafts) -> { line, own }` (no `at`; the hook adds it)
  - `fromDoc(data | undefined) -> drafts` (missing or malformed -> `EMPTY_DRAFTS`)
  - `isOfflineError(err) -> boolean`
  - `withEdits(drafts, edits) -> drafts | null` where `edits = [{ key, before, after }]`; returns `null` when any `before` differs from the saved seats at `key` (compared with `JSON.stringify` of `draftAt(drafts, key)` vs `before`, `undefined`/missing treated as `null`); otherwise applies `withDraft(d, key, after)` for each and returns the result.
  - `lockInto(drafts, locks, waiting) -> drafts` where `locks = [[key, ids]]`; for each lock, writes `ids` at `key` only if `draftSeats(d, [key], waiting)[key]` is null and none of `ids` already sits in another saved match; returns the same object when nothing was written.

- [ ] **Step 1: Write the failing check**

```js
// Self-check for the stored Up Next line. Run: node src/utils/upNextData.check.mjs
import assert from "node:assert";
import { EMPTY_DRAFTS } from "./rotationModes.js";
import { fromDoc, isOfflineError, lockInto, toDoc, withEdits } from "./upNextData.js";

const J = ["j1", "j2", "j3", "j4"], M = ["m1", "m2", "m3", "m4"];
const d = { line: [J, null, ["m1", null, "m3", null]], own: { c3: ["k1", "k2", null, null] } };
// round trip, null seats and a null line entry survive; no array directly inside an array on disk
assert.deepEqual(fromDoc(toDoc(d)), d);
assert.ok(toDoc(d).line.every((m) => m === null || Array.isArray(m.seats)));
assert.deepEqual(fromDoc(undefined), EMPTY_DRAFTS);
assert.deepEqual(fromDoc({ line: "x" }), EMPTY_DRAFTS);
assert.deepEqual(fromDoc({ line: [{ seats: J }] }), { line: [J], own: {} });
// offline detection
assert.equal(isOfflineError({ code: "unavailable" }), true);
assert.equal(isOfflineError({ code: "failed-precondition" }), true);
assert.equal(isOfflineError({ code: "permission-denied" }), false);
// guarded edit: applies when the screen saw the saved seats, refuses when another device changed them
const seen = { line: [J, M], own: {} };
assert.deepEqual(withEdits(seen, [{ key: "line-1", before: M, after: ["m1", null, "m3", "m4"] }]).line[1], ["m1", null, "m3", "m4"]);
assert.equal(withEdits({ line: [J, ["x1", "m2", "m3", "m4"]], own: {} }, [{ key: "line-1", before: M, after: J }]), null);
assert.deepEqual(withEdits(EMPTY_DRAFTS, [{ key: "c3", before: null, after: J }]).own.c3, J); // filling a new slot
// lock-in: only an empty slot, never a player already in another saved match, same object when nothing to do
const waiting = new Set([...J, ...M]);
assert.deepEqual(lockInto({ line: [J], own: {} }, [["line-1", M]], waiting).line, [J, M]);
const full = { line: [J, M], own: {} };
assert.equal(lockInto(full, [["line-1", ["z1", "z2", "z3", "z4"]]], waiting), full);
assert.equal(lockInto({ line: [J], own: {} }, [["line-1", ["j1", "m2", "m3", "m4"]]], waiting).line.length, 1);
console.log("upNextData checks passed");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/utils/upNextData.check.mjs`
Expected: FAIL, `Cannot find module` for `upNextData.js`.

- [ ] **Step 3: Implement the five exports in `src/utils/upNextData.js`**

`toDoc` wraps each non-null line entry as `{ seats: [...] }` (null stays null); `fromDoc` unwraps and passes the result through `asDrafts` so malformed data becomes `EMPTY_DRAFTS`. One comment line at the top saying why the wrapping exists (Firestore refuses an array directly inside an array).

- [ ] **Step 4: Run the checks**

Run: `node src/utils/upNextData.check.mjs && node src/utils/rotationModes.check.mjs`
Expected: `upNextData checks passed` and `rotationModes checks passed`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/upNextData.js src/utils/upNextData.check.mjs
git commit -m "feat: helpers for the shared Up Next line (stored shape, guarded edits, lock-in)"
```

---

### Task 2: Rules test for `private/upNext`

**Files:**
- Create: `tests/upnext.test.mjs`
- Modify: `package.json` (`test:rules`: append `&& node tests/upnext.test.mjs` inside the quoted command)

**Interfaces:**
- Consumes: nothing from other tasks. Follow `tests/umpire.test.mjs` for setup (`initializeTestEnvironment`, `real(uid)`, `anon(uid)`, `signedOut`, `seed()` with rules disabled).
- Produces: nothing. This proves the spec's "no rules change" claim.

- [ ] **Step 1: Write the test**

Seed: `clubs/pub` (public, owner `own`), `members/mgr` role `manager`, `members/mem` role `member`, a live event `clubs/pub/events/ev1` with `private/upNext` = `{ line: [{ seats: ["p1","p2","p3","p4"] }], own: {} }`, and `sessions/own1/private/upNext` with the same data.

Assertions (each its own `await assert...`):
- `assertSucceeds(getDoc(doc(real("mgr"), "clubs/pub/events/ev1/private/upNext")))`
- `assertSucceeds(setDoc(doc(real("mgr"), "clubs/pub/events/ev1/private/upNext"), { line: [], own: {} }))`
- `assertFails(getDoc(doc(real("mem"), "clubs/pub/events/ev1/private/upNext")))`
- `assertFails(setDoc(doc(real("mem"), "clubs/pub/events/ev1/private/upNext"), { line: [], own: {} }))`
- `assertFails(getDoc(doc(anon("viewer"), "clubs/pub/events/ev1/private/upNext")))`
- `assertFails(getDoc(doc(signedOut, "clubs/pub/events/ev1/private/upNext")))`
- `assertSucceeds(getDoc(doc(anon("own1"), "sessions/own1/private/upNext")))`
- `assertSucceeds(setDoc(doc(anon("own1"), "sessions/own1/private/upNext"), { line: [], own: {} }))`
- `assertFails(getDoc(doc(anon("other"), "sessions/own1/private/upNext")))`

End with `console.log("upnext rules: ok")` and `await env.cleanup()`.

- [ ] **Step 2: Run it**

Run (new terminal so Java and the Firebase CLI are on PATH): `npm run test:rules`
Expected: every earlier suite passes as before, then `upnext rules: ok`. If any assertion fails, stop: the spec's "no rules change" premise is wrong and the spec must be revisited before Task 3.

- [ ] **Step 3: Commit**

```bash
git add tests/upnext.test.mjs package.json
git commit -m "test: managers only read and write a game's shared Up Next"
```

---

### Task 3: `useUpNext` hook and QueueApp's writes

**Files:**
- Create: `src/hooks/useUpNext.js`
- Modify: `src/QueueApp.jsx` (state at lines 95-107; `liveDrafts` / trim effect ~402-416; `startNextMatch` ~444; `sendPreviewToCourt` ~471; `removeCourt` ~543; `autoFillCourts` ~565-620; `recordWin` ~636-760; Dashboard props ~934)

**Interfaces:**
- Consumes: `toDoc`, `fromDoc`, `isOfflineError` (Task 1); `withoutDraft`, `withDraftBack`, `draftAt` (`rotationModes.js`).
- Produces (used by Task 4):
  - `useUpNext(base) -> { drafts, loaded, changeUpNext, commitWithUpNext }`
  - `changeUpNext(fn: drafts => drafts | null) -> Promise<"saved" | "unchanged" | "refused">`: `null` from `fn` means refused (nothing written).
  - `commitWithUpNext({ change, addWrites, guard }) -> Promise<{ ok: boolean, message?: string }>`: `change: drafts => drafts`, `addWrites: (writer) => void` called with a `Transaction` or a `WriteBatch` (same `set` / `update` / `delete` signatures), `guard: async (tx, drafts) => string | null` or `null` (a message means abort; only run in the transaction path). Resolves `{ ok: true }` when written, `{ ok: false, message }` when the guard aborted; the caller shows `message`.
  - Dashboard props: `drafts={drafts}`, `upNextLoaded={loaded}`, `changeUpNext={changeUpNext}` replace `setDrafts`. Until Task 4 lands, keep passing `setDrafts={(f) => changeUpNext(typeof f === "function" ? f : () => f)}` so the Dashboard keeps working.

- [ ] **Step 1: Implement `src/hooks/useUpNext.js`**

- `onSnapshot(doc(db, ...base, "private", "upNext"))` -> `drafts = fromDoc(snap.data())`, `loaded = true` after the first snapshot (also on error, so the screen isn't stuck; log nothing).
- Keep the latest drafts in a ref (`seenRef`) for the offline fallback.
- `changeUpNext(fn)`: `runTransaction` that `tx.get`s the doc, `next = fn(fromDoc(data))`; `null` -> return "refused"; same object -> "unchanged"; else `tx.set(ref, { ...toDoc(next), at: serverTimestamp() })`. On `isOfflineError(e)`: apply `fn` to `seenRef.current` and `setDoc` the result (not awaited past the local write: `setDoc(...).catch(() => {})`), return "saved" or the refusal. Other errors rethrow.
- `commitWithUpNext({ change, addWrites, guard })`: `runTransaction` that `tx.get`s the line doc, runs `guard` if given (a message -> the transaction returns `{ ok: false, message }` without writing), calls `addWrites(tx)`, writes the changed line if `change` returned a new object, returns `{ ok: true }`. Offline: `writeBatch`, `addWrites(batch)`, line from `change(seenRef.current)`, `batch.commit()` without awaiting the server (`.catch(() => {})`), return `{ ok: true }`. Other errors rethrow (callers already show their "Couldn't ..." toasts).
- Migration, once per mount after the first snapshot: if the snapshot had no document and `localStorage.getItem("cf-upnext-line:" + base.join("/"))` parses to a non-empty drafts, run a transaction that creates the doc only if it is still missing, then remove the key (in try/catch: private mode).


- [ ] **Step 2: Replace the local state in `QueueApp.jsx`**

Delete `draftsKey`, the `useState` for `upNextDrafts` and its localStorage effect; add `const { drafts: upNextDrafts, loaded: upNextLoaded, changeUpNext, commitWithUpNext } = useUpNext(base);`. The trim effect becomes `changeUpNext((d) => d.line.length > size ? { ...d, line: d.line.slice(0, size) } : d)`, still only when `upNextDrafts.line.length > size`.

- [ ] **Step 3: Seating writes through `commitWithUpNext`**

- `sendPreviewToCourt(courtId, a, b, key)`: `guard` `tx.get`s the court and returns `"That court isn't open right now."` if it has players, and `"That match already went on court."` if `draftAt(d, key)` no longer holds those ids (use the same order-free comparison `withoutDraft` uses: a line match found by who is in it). `addWrites`: the court `update` it does today. `change`: `withoutDraft(d, key, [...a, ...b])`. On `{ ok: false, message }` -> `notify(message)` and stop.
- `startNextMatch`, draft branch: same guard and change as above with `nextIds`; the fresh-pick branch stays a plain `updateDoc`.
- `autoFillCourts`: replace the `writeBatch` with `commitWithUpNext`; move every `batch.update/set` into `addWrites`; `change` applies `withoutDraft` for each entry of `usedDrafts`. Guard: none (pass `null`).
- `recordWin`: replace `batch` with `commitWithUpNext` (`addWrites` = today's batch writes, `change` = `usedEdit ? withoutDraft(d, next.key, next.ids) : d`). Keep building `undo` as a list of writes instead of a `WriteBatch` (`undoWrites.push((w) => w.update(...))`); `undoResult` keeps its busy-court check, then `commitWithUpNext({ addWrites: (w) => undoWrites.forEach((f) => f(w)), change: (d) => usedEdit ? withDraftBack(d, next.key, next.ids) : d })`.
- `removeCourt`: put its court writes in `addWrites` and the `own` remap in `change`.
- Remove the now-unused `setUpNextDrafts` references; `writeBatch` stays imported if other functions still use it.

- [ ] **Step 4: Run the checks and the build**

Run: `node src/utils/upNextData.check.mjs && node src/utils/rotationModes.check.mjs && node src/utils/queueStatus.check.mjs && npx vite build`
Expected: three "passed"/"ok" lines and a successful build with no errors.

- [ ] **Step 5: Quick smoke in the browser**

With `npm run emulators` + `npm run dev:emu` and `node scripts/seed-queue.mjs`, sign in as `sq6@demo.test` / `password1`, open `/club`, start a court, Send to Court, record a win. Expected: same behavior as before this change, no console errors, and `private/upNext` visible in the emulator UI (`http://127.0.0.1:4000/firestore`) under `sessions/{uid}`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useUpNext.js src/QueueApp.jsx
git commit -m "feat: Up Next line saved in Firestore; seating writes change court and line together"
```

---

### Task 4: Dashboard edits through the shared line

**Files:**
- Modify: `src/views/Dashboard.jsx` (props ~494; `setDraft` ~517; `autoFillUpNext` ~539-561; lock effect ~575-587; `CourtPreview` `setDraft` prop ~714)
- Modify: `src/QueueApp.jsx` (drop the temporary `setDrafts` adapter; pass `changeUpNext` and `upNextLoaded`)

**Interfaces:**
- Consumes: `changeUpNext`, `upNextLoaded` (Task 3); `withEdits`, `lockInto` (Task 1); `withoutUsedLine` (`rotationModes.js`).
- Produces: nothing for later tasks.

- [ ] **Step 1: Guarded host edits**

`setDraft(key, ids)` becomes `changeUpNext((d) => withEdits(d, [{ key, before: draftAt(drafts, key), after: ids }]))`; on `"refused"` -> `notify("Up Next changed on another device. Try again.")`. `before` is the raw saved value the screen rendered (`draftAt(drafts, key)`, not the waiting-filtered `draftOf`).

- [ ] **Step 2: Up Next Auto-fill**

Build `edits` (one `{ key, before: draftAt(drafts, key), after }` per filled match) instead of the local `next`, then one `changeUpNext((d) => withEdits(d, edits))`. Same toast text as today when filled; the refusal toast from Step 1 when refused.

- [ ] **Step 3: Lock-in effect**

- Return early while `!upNextLoaded` or `manual`, or while `lockingRef.current` is true.
- If `withoutUsedLine(drafts, waiting) !== drafts`: set `lockingRef.current = true`, `changeUpNext((d) => withoutUsedLine(d, waiting)).finally(() => { lockingRef.current = false; })`, return.
- Else collect `locks` (same picks as today: `[key, [...a, ...b]]` for each full, unlocked pick) and, if any, run `changeUpNext((d) => lockInto(d, locks, waiting))` with the same in-flight guard.
- Errors from these background writes are swallowed (`.catch(() => {})`): the listener shows whatever is saved.

- [ ] **Step 4: Run checks and build**

Run: `node src/utils/upNextData.check.mjs && node src/utils/rotationModes.check.mjs && npx vite build`
Expected: both checks pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/views/Dashboard.jsx src/QueueApp.jsx
git commit -m "feat: Up Next edits and lock-in go through the shared line"
```

---

### Task 5: Two-manager browser test, docs

**Files:**
- Modify: `scripts/seed-queue.mjs` (a club `upnext-club` owned by `sq7@demo.test` with manager `sq8@demo.test`, one live event with 16 checked-in players and 2 courts; follow how the file seeds sessions, writing `clubs/...`, `members/...`, `accounts/{uid}/memberships/...`, the event with `status: "live"`, and its `players` / `courts`)
- Modify: `CLAUDE.md` (one bullet under "Already built", next to the Up Next / shared line notes)

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Seed and open two managers**

`node scripts/seed-queue.mjs`; `playwright-cli -s=m1 open --headed` signed in as `sq7@demo.test`, `playwright-cli -s=m2 open --headed` as `sq8@demo.test`, both on `/clubs/{id}/event/{eventId}/game`.
Expected: both Dashboards show the same Match 1 / Match 2.

- [ ] **Step 2: Each action, compare both screens**

In m1: Send to Court; record a win; swap a player in Match 1; empty a seat; Up Next Auto-fill; Undo the last result. After each, read both screens' Up Next with the `.court.preview` eval used on 2026-11-07.
Expected: identical lines in m1 and m2 after every action (within 2 s).

- [ ] **Step 3: Near-simultaneous taps**

Open a court, then press Send to Court on the same card in m1 and m2 back to back (two commands in one shell line).
Expected: the group is on one court only; one window shows "That match already went on court." Then swap the same seat in both windows back to back: one swap applies, the other shows "Up Next changed on another device. Try again."

- [ ] **Step 4: Offline round trip**

In m1: `playwright-cli -s=m1 run-code "async page => page.context().setOffline(true)"`, record a win and swap a player, then `setOffline(false)`.
Expected: m2 shows the result and the swap within a few seconds of m1 reconnecting; no console errors in either window.

- [ ] **Step 5: Phone width once**

`playwright-cli -s=m2 resize 390 844`, screenshot Up Next.
Expected: no sideways scroll (`document.documentElement.scrollWidth === 390`).

- [ ] **Step 6: Docs and commit**

Add to `CLAUDE.md`: "Shared Up Next (spec `docs/superpowers/specs/2026-11-07-shared-up-next-design.md`): the Up Next line is `{base}/private/upNext` (`hooks/useUpNext.js`, helpers `utils/upNextData.js`, check `node src/utils/upNextData.check.mjs`), the same for every manager of a game, edited through transactions (`changeUpNext`, `commitWithUpNext`; offline falls back to a plain write). Seating writes change the court and the line together. Live Board / members' page still compute their own line. No rules change; rules test `tests/upnext.test.mjs`."

```bash
git add scripts/seed-queue.mjs CLAUDE.md
git commit -m "test: two-manager Up Next demo seed; docs for the shared line"
```
