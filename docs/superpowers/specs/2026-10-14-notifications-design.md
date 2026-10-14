# Notifications bell (in-app)

Date: 2026-10-14. Status: design approved in chat, spec awaiting review.

## Purpose

A bell in the sticky top bar (`.acct-topbar`, just left of the account menu) that tells a signed-in person what needs
them right now, without opening Friends, Inbox and each club in turn. It is in-app only: no push, no email, no history.

Success: a person with a friend request, an unread chat, a join request to approve (owner or manager) or a turn coming up
sees a badge on every screen, opens one panel, and goes straight to the right page. Handling the thing removes its line.

## Decisions made with the owner

- Covers four things: friend requests, unread messages, join requests (owners and managers), "your turn" alerts.
- **Computed live from data the app already loads** (no stored notification documents, no writes by other people,
  no `firestore.rules` change). The alternative, a stored feed written by other users, was rejected: it needs cross-user
  writes and a change at every trigger.
- First version covers turn alerts only. "Open play starting soon" and "moved up from the waitlist" are **step 2**: the
  account has no list of its own bookings (booking ids live in the browser that booked), so they need a copy of each
  booking saved on the account at booking time.
- Not built: push or email, notification settings, a history of past notifications, a separate "Mark all read" button
  (opening the bell already clears the badge).

## What the list shows

Sorted turn alerts, then friend requests, join requests, chats; inside a group, newest first. Each line has an icon, one
sentence, a small second line, and is a plain link.

| Kind | Source (already in the app) | Text | Opens |
|---|---|---|---|
| `turn` | `useActiveGames`: a game where the person is a checked-in player and `status.upNext` or `status.state === "playing"` | "You're up next on Court 2" / "You're on Court 2"; second line: club name | that game's queue page (`queuePath`) |
| `friend` | `friendBuckets(friendships, uid).received` | "Ana sent you a friend request" | `/friends` |
| `join` | pending `clubs/{id}/joinRequests` of every club where the person's role is owner or manager | "Dee asked to join Pub Club" | `/clubs/{id}/members` |
| `chat` | the Inbox chats with `isUnread(chat, reads[chat.id]?.at, uid)` | club chat: "New message in Pub Club", second line the last message (a club chat document has no sender name); direct message: "Cal sent you a message", second line the last message | `/inbox/{chatId}` |

The panel shows at most 20 lines, then "and N more" linking to Inbox. Items clear on their own: accepting the friend
request, reading the chat, answering the join request, or the turn passing removes the line. Nothing is stored for them.

## Badge and "seen"

- Each item has a stable key including what makes it new: `friend:{friendshipId}`, `join:{clubId}:{uid}`,
  `chat:{chatId}:{lastAt}` (the sender of a direct message comes from `chat.names[chat.lastBy]`), `turn:{clubId}/{eventId}:{state}:{games}` (`games` is the player's games played, so each turn in the same game is a new alert).
- Badge = number of items whose key is not in the person's seen set. Shown as a count ("9+" above nine), hidden at zero.
- Opening the panel adds every current key to the seen set. The lines stay until handled, like an inbox. A new message
  (new `lastAt`), a new request or a new turn state has a new key, so the badge comes back.
- The seen set is kept **on the device** (`localStorage` key `courtflow.notifSeen`, capped to the 200 newest keys, all
  reads and writes wrapped in try/catch so a blocked store just means "everything counts as new"). A second device
  shows its own badge. Moving it onto the account is a later option; nothing here blocks it.

## Pieces

- `src/utils/notifications.js` (pure, no Firestore): `buildNotifications({ uid, friendships, chats, reads, joinRequests,
  activeGames, clubs })` returns the sorted items `{ key, kind, title, sub, to, at }`; `unseenCount(items, seen)`;
  `markSeen(seen, items)` (returns the capped new set). Check: `node src/utils/notifications.check.mjs`.
- `src/hooks/useManagerJoinRequests.js`: one `onSnapshot` per club where the role is owner or manager, on
  `clubs/{id}/joinRequests` where `status == "pending"` (the same query as `useJoinRequests`; managers may already read
  it). Returns the requests with their club id and name. A refused listener ends quietly with no items.
- `src/components/NotificationBell.jsx`: the bell button (`aria-label` "Notifications, 3 new" / "Notifications"), the
  panel, the seen set.
- `AccountApp` builds the items from what it already holds (`friendships`, `inbox`, `activeGames`, `clubs`) plus the new
  join-request hook, and hands them to `AccountSidebar`, which renders the bell in `.acct-topbar` before `AccountMenu`.
  The inbox hook is extended only if it does not already expose each chat's unread state and the read positions.
- Styles go in `src/clubs.css` under `.acct-` (never `styles.css`), tokens only: the badge uses `--accent` with
  `--on-accent`; panel, rows and hover follow the existing account menu and `.find-row` look.

## Behavior and layout

- The panel opens under the bell, about 360px wide; under 560px it spans the screen width below the top bar.
- Closes on Escape (`useEscape`), a click outside, and choosing a line. Escape returns focus to the bell.
- Rows are at least 44px tall; the whole row is the link; visible keyboard focus.
- Empty: "You're all caught up." Not signed in (old club logins, the quick session): the bell is not rendered.
- The badge changes are announced politely (`aria-live="polite"` on a visually hidden count), not on every snapshot,
  only when the unseen count rises.
- Under 860px the top bar is the dark phone bar: the bell is icon-only there, sized like the avatar trigger.

## Errors and edge cases

- A listener that is refused or offline contributes no items; the others still work. No error is shown.
- Removed or left clubs drop their join-request listener when `clubs` changes (the effect re-subscribes on the club
  id and role list).
- A person who is both a player and the host of a game gets the turn alert only (the host-only entry has no `status`).
- Many requests: the list is capped, the badge counts all unseen.

## Testing

- Check file for the pure functions: ordering, keys, the 20 cap, badge count with and without a seen set, a new
  `lastAt` re-flagging a chat, `markSeen` capping at 200, host-only games producing no turn alert.
- Browser (emulators, Node Playwright, desktop and 390px): seed a friend request, an unread chat, a pending join request
  as owner, and a live game with the person up next; confirm the badge count, the order, each link target, the badge
  clearing on open and returning on a new item, Escape and outside-click closing, and no horizontal scroll.
- `npm run test:rules` is unaffected (no rules change); the manager join-request read is already covered by
  `tests/membership.test.mjs`.

## Out of scope for this spec

Booking reminders ("starting soon", "moved up from the waitlist") and the account copy of bookings they need; push,
email and settings; syncing "seen" across devices.
