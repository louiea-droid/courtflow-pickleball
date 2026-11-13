# Account Settings (2026-11-13)

## Why
The owner wants one Settings page for the person's own account, clearly separate from a club's Settings
(which is now a tab in each club). Profile already holds most account things; it becomes part of this page.

## Approaches
- **A. One tabbed Settings page replacing Profile (picked by the owner).** Account menu "Profile" becomes "Settings" at
  `/settings`, tabs like a club's Settings. One place for everything personal.
- B. Keep Profile and add a Settings page beside it. Rejected: two menu items, unclear which holds what.

## Design
- Route stays `/settings` (route name `settings`); `views/Profile.jsx` becomes the tabbed page (title "Settings",
  visible), same `.settings-tabs` bar and `#hash` tab memory as `ClubSettings`. Account menu item: **Settings** (gear).
- Tabs:
  - **Account**: the existing deep green band (name with rename pencil, email, friend code with Copy), Password row.
  - **Appearance**: Light / Dark / Match device cards (unchanged; the top-bar button writes the same `display.theme`).
  - **Notifications**: five switches, one per bell kind: your turn (`turn`), bookings (`booking`), friend requests
    (`friend`), join requests (`join`), chat messages (`chat`). Saved on the account as `notify: { [kind]: false }`
    (missing = on), so it follows the person across devices. `AccountApp` drops muted kinds before passing the
    items to the bell (pure helper `filterMuted` in `utils/notifications.js`, covered by its check). Sidebar
    Friends / Inbox count badges are unchanged.
  - **Privacy**: "Let people find me by name".
  - **Danger zone**: Delete account.
- Not touched: club Settings, the quick session's Settings, `firestore.rules` (accounts/{uid} is owner-writable).

## Non-goals
Devices (owner: don't), push or email, per-club notification choices, syncing "seen" across devices.

## Left to the builder
Copy for each switch, Help / Guide text that says "Profile", CLAUDE.md note.
