# Shared Up Next

Approved in chat 2026-11-07. The Up Next line (Match 1, 2, 3 and each level court's own match) is the same on every
manager's device and updates live, instead of living in each browser's localStorage.

## Why

Since "lock Up Next" (`f384364`) and the shared line (`37284da`), the locked Up Next matches are saved per device
(`cf-upnext-line:{base}` in localStorage, `QueueApp.jsx`). Two managers running the same open play each have their own
line: they can see different groups as Match 1, a swap or emptied seat on one screen never reaches the other, and
whoever presses Send to Court or records a win seats the match from their own screen. Everything else in a game (courts,
players, results, scores) already syncs through Firestore.

## Who sees it

- **Managers** of the club (event game) and the **owner** of a quick session: one shared line, live.
- **Not changed**: the Live Board, the members' "View queue" page and the Home card keep working out the line from the
  queue (`upNextPlan`), as today. They can differ from the managers' line after a manager edits Up Next. **Show on Live
  Board** still shows the manager's teams (`court.nextUp`).

## Where it lives

- One document per game: `{base}/private/upNext`, where `base` is the queue app's path (`eventBase(clubId, eventId)` or
  `sessionBase(uid)`).
- **No rules change.** Under an event, the existing `match /{sub}/{docId}` wildcard already lets managers read and write
  `private/*` and nobody else read it (members only read `players` and `courts`; the `private` rule for umpires and Live
  Board screens only allows `get` of `umpire` and `live`). Under a quick session, the wildcard excludes `private` from
  public reads and only the owner (`isClub`) writes. Delete cascades already include `private`
  (`EVENT_SUBCOLLECTIONS`, `SESSION_SUBCOLLECTIONS`).
- Shape: `{ line: [{ seats: [id | null, ...] } | null, ...], own: { [courtId]: [id | null, ...] }, at }`. This is today's
  in-memory drafts (`{ line: [ids], own: { courtId: ids } }`, see `asDrafts` in `utils/rotationModes.js`) wrapped for
  Firestore, which can't store an array directly inside an array. `at` is `serverTimestamp()` of the last write.
- `utils/upNextData.js` (pure): `toDoc(drafts)` / `fromDoc(data)` convert between the two shapes; `fromDoc` of a missing
  or malformed document is `EMPTY_DRAFTS`.

## Reading

- New hook `hooks/useUpNext.js` (`useUpNext(base)`): one `onSnapshot` on `{base}/private/upNext`, returning
  `{ drafts, changeUpNext }`. `drafts` replaces `upNextDrafts` in `QueueApp` and is passed to the Dashboard as now.
- Firestore's offline cache (`persistentLocalCache` in `firebase.js`) shows a device's own writes at once and keeps the
  line through short connection drops.

## Changing it

All writes are transactions, so two managers acting at the same moment never lose an edit (Firestore re-runs the losing
one on top of the winner).

- `changeUpNext(fn)`: in a transaction, read `{base}/private/upNext`, `next = fn(fromDoc(data))`, write `toDoc(next)`
  only if `next !== current` (the helpers already return the same object when nothing changes). `fn` is one of the
  existing pure helpers: `withDraft`, `withoutDraft`, `withDraftBack`, `withoutUsedLine`, and the line trim for removed
  courts. Used by: the Dashboard's swaps / fills / skips (`setDraft`), Up Next **Auto-fill**, the "move up" step
  (`withoutUsedLine`), and the trim effect in `QueueApp`.
- **Seating writes** (`sendPreviewToCourt`, `startNextMatch`, `autoFillCourts`, `recordWin`) already write courts. Each
  becomes one transaction that reads the line, removes the used match by who is in it (`withoutDraft(d, key, ids)`),
  and writes the courts and the line together. The other screens never see a court filled while its match is still in
  the line. **Undo** of a result puts the match back with `withDraftBack` in the same way.
  - `recordWin` and `autoFillCourts` use `writeBatch` today; they move to `runTransaction` with the same writes plus
    the line. Reads they need from the courts stay as they are (the transaction only reads the line document).
- **Automatic lock-in** (the Dashboard effect that locks a full pick into an empty slot): every manager's screen may
  run it. Its transaction only writes a slot that is still empty in the latest saved line; if another screen locked it
  first, it writes nothing and the screen shows that line from the listener. Picks are deterministic (`upNextPlan`,
  stable `tieRoll`), so two screens normally pick the same group anyway.
- The lock effect only runs after the first snapshot of the line has arrived, so a screen that is still loading never
  locks over a line it hasn't seen.

## Offline

Transactions need the server: offline, `runTransaction` fails instead of queuing. Recording a win or sending a match
must keep working through a Wi-Fi drop (it does today, through the offline cache), so:

- **Seating writes** try the transaction first. If it fails because the device is offline (`unavailable` /
  `failed-precondition` from the SDK), they fall back to a `writeBatch` with the same court writes and the line
  computed from the line the device last saw (the listener's `drafts`). It is queued by the offline cache and uploaded
  when the connection returns. Last write wins for the line in that case; a match removed by who is in it can't be
  duplicated, and the next lock-in pass repairs an empty slot.
- **`changeUpNext`** (swaps, fills, lock-in) does the same: offline it writes the changed line with a plain `setDoc`
  from the last seen line, so an edit is never silently dropped.
- Any other transaction error (permission, a removed game) shows the usual "Couldn't save" toast and changes nothing.

## Rollout

- When a manager opens a game and `{base}/private/upNext` doesn't exist yet, a device holding a local line
  (`cf-upnext-line:{base}`) uploads it once (a transaction that only creates the document if it is still missing), then
  removes the local key. After that, localStorage is not used for Up Next.
- No rules publish needed. Deploy hosting as usual.

## Testing

- `node src/utils/upNextData.check.mjs`: `toDoc` / `fromDoc` round trip (null seats, null line entries, level courts,
  empty), malformed input gives `EMPTY_DRAFTS`.
- Existing checks stay green: `rotationModes.check.mjs`, `queueStatus.check.mjs`.
- Rules test (`tests/upnext.test.mjs`, `npm run test:rules`): a manager reads and writes `events/{e}/private/upNext`; a
  member, an anonymous Live Board viewer and a signed-out visitor can't read it; a quick session's owner can, another
  user can't.
- Offline: one window goes offline (`playwright-cli` network off or the emulator stopped), records a win and swaps a player, comes back; the other window then shows both.
- Browser (emulators, Playwright CLI): two windows signed in as two managers of the same club on the same live game.
  Send to Court, record a win, swap a player, empty a seat, Up Next Auto-fill, Undo: both screens show the same line
  after each. Two near-simultaneous taps (both windows press Send to Court / swap within a second): no lost edit, no
  group seated twice. Phone width (390px) once.

## Not included

- The Live Board, members' queue page and Home card reading the managers' line (needs a rules change; later if wanted).
- Showing which manager made a change, or an edit history.
- The Winners / Losers question from 2026-11-07 (challengers come from outside Up Next): separate change.
