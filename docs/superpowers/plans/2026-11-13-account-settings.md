# Account Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn Profile into a tabbed account Settings page with a Notifications tab that mutes bell kinds.

**Architecture:** `views/Profile.jsx` gets the `.settings-tabs` bar (hash-remembered, like `ClubSettings`). Muted kinds
live on `accounts/{uid}.notify`; `AccountApp` filters the bell items through a pure `filterMuted`.

**Tech Stack:** React 18, Firebase Firestore, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-13-account-settings-design.md`

## Global Constraints
- Tabs: Account, Appearance, Notifications, Privacy, Danger zone. Bell kinds: `turn`, `booking`, `friend`, `join`, `chat`.
- `notify: { [kind]: false }` on the account; a missing key means on.
- No `firestore.rules` change. Theme tokens only. Check at 390px and desktop.

## Review Focus
- Account with no `notify` field: every kind shows (test in Task 1).
- `notify` with an unknown key or `true` values: nothing hidden wrongly (test in Task 1).
- A muted kind must also drop out of the bell badge count (the badge counts the filtered items; checked in the browser).
- Opening `/settings#notifications` directly lands on that tab (browser check, Task 2).
- ClubApp's bell uses the same filtered list (it receives `notifications` from AccountApp; browser check).

---

### Task 1: `filterMuted`

**Files:** Modify `src/utils/notifications.js`, `src/utils/notifications.check.mjs`

**Interfaces:** Produces `filterMuted(items: Item[], notify?: Record<string, boolean>): Item[]`, `NOTIFY_KINDS: [kind, label, body][]`.

- [ ] Add asserts: `filterMuted(items)` returns all; `filterMuted(items, { chat: false })` has no `chat`; `{ chat: true, foo: false }` returns all.
- [ ] Run `node src/utils/notifications.check.mjs`: fails (not defined).
- [ ] Implement (`items.filter((i) => notify?.[i.kind] !== false)`), plus `NOTIFY_KINDS`.
- [ ] Run the check: passes.

### Task 2: Tabbed Settings page

**Files:** Modify `src/views/Profile.jsx`, `src/AccountApp.jsx`, `src/components/AccountMenu.jsx`, `src/clubs.css`, `src/data/help.js`, `src/data/guide.js` (any "Profile" wording), `CLAUDE.md`

**Interfaces:** Consumes `filterMuted`, `NOTIFY_KINDS`, `Toggle` from `views/Settings.jsx`.

- [ ] Profile.jsx: visible "Settings" title, `.settings-tabs` (hash), sections per tab; Notifications = one `Toggle` per `NOTIFY_KINDS` writing `updateAccount({ notify: { ...account.notify, [kind]: on } })`.
- [ ] AccountApp: `filterMuted(buildNotifications(...), acct.account?.notify)`.
- [ ] AccountMenu: "Profile" → "Settings" with a gear icon.
- [ ] Help / Guide text and CLAUDE.md updated; `node src/utils/help.check.mjs` and `guide.check.mjs` pass.
- [ ] `npx vite build` clean; browser check at 1280 and 390: each tab, mute chat → its bell line and count go, reload keeps it.
