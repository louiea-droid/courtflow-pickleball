# Notifications Bell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bell in the account top bar that lists friend requests, unread chats, join requests (owners and managers) and "your turn" alerts, with a badge for what the person hasn't seen yet.

**Architecture:** A pure function turns data `AccountApp` already holds (friendships, inbox chats and read marks, active games) plus one new listener set (pending join requests of every club the person owns or manages) into a sorted list. A bell component shows the list and keeps a per-device "seen" set in `localStorage`. No stored notification documents, no `firestore.rules` change.

**Tech Stack:** React 18, Firebase Firestore (`onSnapshot`), lucide-react, Vite. Pure-logic checks are plain Node scripts (`node src/utils/<name>.check.mjs`, `node:assert/strict`). Browser checks use Node Playwright against the emulators.

**Spec:** `docs/superpowers/specs/2026-10-14-notifications-design.md`

## Global Constraints

- In-app only: no push, no email, no notification settings, no history, no stored notification documents.
- `firestore.rules` and `firestore.indexes.json` are not changed.
- New styles go in `src/clubs.css` under `.acct-bell*`, never in `styles.css`; colors are theme tokens (`--accent`, `--on-accent`, `--panel`, `--soft`, `--ink`, `--muted`, `--card-line`, `--accent-soft`, `--accent-line`), never raw hex except the existing phone-bar values already used in `clubs.css` (`#29362e`, `#141d18`).
- `localStorage` key `courtflow.notifSeen`, capped to the 200 newest keys; every read and write is wrapped in try/catch.
- The panel shows at most 20 lines, then "and N more" linking to `/inbox`; the badge counts every unseen item, shows "9+" above nine and is hidden at zero.
- Rows are at least 44px tall; the whole row is a link; keyboard focus is visible; `Escape` closes (via `useEscape`) and returns focus to the bell.
- Under 860px the bell is icon-only, sized like the phone bar's avatar trigger, and the panel is a fixed sheet with 10px side margins.
- Pronouns and copy: sentence case, plain verbs; the exact line texts are in Task 1.
- Check UI at about 390px as well as desktop (`npm run emulators` + `npm run dev:emu`).

## Review Focus

- A message the person wrote themselves is never an unread notification (`isUnread` ignores `lastBy === uid`): Task 1 test.
- 25 items: 20 shown, "5 more", badge still counts 25: Task 1 test.
- `localStorage` unavailable or full: the bell still renders and every item counts as new, no crash: Task 2 browser step.
- The seen set never grows past 200 keys and a new `lastAt` re-flags the same chat: Task 1 test.
- A game the person only hosts (no `status`) or a player who is waiting but not next produces no turn alert: Task 1 test.

---

## File Structure

- Create `src/utils/notifications.js`: pure list building, capping, seen-set helpers.
- Create `src/utils/notifications.check.mjs`: the checks.
- Create `src/hooks/useManagerJoinRequests.js`: pending join requests of every owned or managed club.
- Create `src/components/NotificationBell.jsx`: button, badge, panel, seen-set storage.
- Modify `src/components/AccountSidebar.jsx`: new `notifications` prop, renders the bell before `AccountMenu`.
- Modify `src/AccountApp.jsx`: builds the items, passes them to `AccountSidebar` and `ClubApp`.
- Modify `src/ClubApp.jsx`: accepts `notifications`, passes it to its `AccountSidebar`.
- Modify `src/clubs.css`: bell styles.
- Modify `CLAUDE.md`: one entry describing the bell.

---

### Task 1: Pure notification logic

**Files:**
- Create: `src/utils/notifications.js`
- Test: `src/utils/notifications.check.mjs`

**Interfaces:**
- Consumes: `friendBuckets(friendships, me)` from `./friends.js` (returns `{ friends, received, sent }`; each row has `id`, `users`, `name`, `status`, `requestedBy`); `isUnread(chat, readAt, uid)` from `./chat.js`. Active games are the objects `useActiveGames` returns: `{ club: { id, clubName }, event: { id }, status?: { state: "playing"|"waiting", court?, upNext?, nextOn? }, host?: true, gamePath, queuePath }`. Chats are the inbox chats: `{ id, kind: "club"|"dm", title?, names?, lastText, lastBy, lastAt }`. Join requests: `{ id, clubId, clubName, name, createdAt }`.
- Produces: `MAX_ITEMS = 20`, `MAX_SEEN = 200`, `buildNotifications({ uid, friendships, chats, reads, joinRequests, activeGames }) -> Item[]`, `capItems(items) -> { shown, more }`, `unseenCount(items, seen) -> number`, `markSeen(seen, items) -> string[]` (returns the same array reference when nothing is new). `Item = { key, kind: "turn"|"friend"|"join"|"chat", title, sub, to, at }`. `seen` is an array of keys, oldest first.

- [ ] **Step 1: Write the failing check**

Create `src/utils/notifications.check.mjs`:

```js
import assert from "node:assert/strict";
import { MAX_ITEMS, MAX_SEEN, buildNotifications, capItems, markSeen, unseenCount } from "./notifications.js";

const me = "me";
const friendships = [
  { id: "a_me", users: ["a", "me"], names: { a: "Ana", me: "Me" }, status: "pending", requestedBy: "a" }, // received
  { id: "b_me", users: ["b", "me"], names: { b: "Bo", me: "Me" }, status: "pending", requestedBy: "me" }, // sent: no line
  { id: "c_me", users: ["c", "me"], names: { c: "Cy", me: "Me" }, status: "accepted", requestedBy: "c" }, // friend: no line
];
const chats = [
  { id: "club_pub", kind: "club", title: "Pub Club", lastText: "see you at 8", lastBy: "cal", lastAt: 100 },
  { id: "dm_cal_me", kind: "dm", names: { cal: "Cal", me: "Me" }, lastText: "you free?", lastBy: "cal", lastAt: 200 },
  { id: "club_read", kind: "club", title: "Read Club", lastText: "old", lastBy: "cal", lastAt: 50 }, // read below
  { id: "club_mine", kind: "club", title: "Mine Club", lastText: "my own", lastBy: "me", lastAt: 300 }, // my own message
];
const reads = { club_read: { at: 60 } };
const joinRequests = [
  { id: "u1", clubId: "pub", clubName: "Pub Club", name: "Dee", createdAt: 10 },
  { id: "u2", clubId: "pub", clubName: "Pub Club", name: "Eli", createdAt: 20 },
];
const games = [
  { club: { id: "pub", clubName: "Pub Club" }, event: { id: "e1" }, status: { state: "waiting", position: 1, upNext: true, nextOn: 2 }, queuePath: "/clubs/pub/event/e1/queue" },
  { club: { id: "pub", clubName: "Pub Club" }, event: { id: "e2" }, status: { state: "playing", court: 3 }, queuePath: "/clubs/pub/event/e2/queue" },
  { club: { id: "pub", clubName: "Pub Club" }, event: { id: "e3" }, status: { state: "waiting", position: 4, upNext: false }, queuePath: "/clubs/pub/event/e3/queue" }, // waiting, not next
  { club: { id: "pub", clubName: "Pub Club" }, event: { id: "e4" }, host: true, queuePath: "/clubs/pub/event/e4/queue" }, // hosts only
];

const items = buildNotifications({ uid: me, friendships, chats, reads, joinRequests, activeGames: games });

// Order: turn alerts, friend requests, join requests (newest first), chats (newest first).
assert.deepEqual(items.map((i) => i.kind), ["turn", "turn", "friend", "join", "join", "chat", "chat"]);
assert.deepEqual(items.filter((i) => i.kind === "join").map((i) => i.title), ["Eli asked to join Pub Club", "Dee asked to join Pub Club"]);
assert.deepEqual(items.filter((i) => i.kind === "chat").map((i) => i.title), ["Cal sent you a message", "New message in Pub Club"]);
assert.equal(items.find((i) => i.key === "chat:club_pub:100").sub, "see you at 8");

// Turn alerts: only a game the person plays in and is up next or playing; a host-only game and a far-off waiter give none.
const turns = items.filter((i) => i.kind === "turn");
assert.deepEqual(turns.map((t) => t.title).sort(), ["You're on Court 3", "You're up next on Court 2"]);
assert.equal(turns.every((t) => t.sub === "Pub Club" && t.to.endsWith("/queue")), true);
assert.equal(buildNotifications({ uid: me, activeGames: [games[3]] }).length, 0);
assert.equal(buildNotifications({ uid: me, activeGames: [games[2]] }).length, 0);

// Friend: only a request someone else sent; links to /friends.
const friend = items.find((i) => i.kind === "friend");
assert.deepEqual([friend.key, friend.title, friend.to], ["friend:a_me", "Ana sent you a friend request", "/friends"]);

// Join: links to the club's members page (ids are URL-encoded).
assert.equal(items.find((i) => i.key === "join:pub:u2").to, "/clubs/pub/members");
assert.equal(buildNotifications({ uid: me, joinRequests: [{ id: "u", clubId: "a b", clubName: "X", name: "Y", createdAt: 1 }] })[0].to, "/clubs/a%20b/members");

// Chat: a chat I read, and one whose last line I wrote, are not notifications; links to the chat.
assert.equal(items.some((i) => i.key.startsWith("chat:club_read") || i.key.startsWith("chat:club_mine")), false);
assert.equal(items.find((i) => i.key === "chat:dm_cal_me:200").to, "/inbox/dm_cal_me");
// A direct message whose sender has no name on the chat still reads well.
assert.equal(buildNotifications({ uid: me, chats: [{ id: "dm_x_me", kind: "dm", names: {}, lastText: "hi", lastBy: "x", lastAt: 5 }] })[0].title, "Someone sent you a message");

// Cap: 25 items show 20 and "5 more", but all 25 count for the badge.
const many = Array.from({ length: 25 }, (_, i) => ({ id: `u${i}`, clubId: "pub", clubName: "Pub Club", name: `P${i}`, createdAt: i }));
const big = buildNotifications({ uid: me, joinRequests: many });
assert.equal(MAX_ITEMS, 20);
assert.deepEqual([capItems(big).shown.length, capItems(big).more], [20, 5]);
assert.deepEqual([capItems(items.slice(0, 3)).shown.length, capItems(items.slice(0, 3)).more], [3, 0]);
assert.equal(unseenCount(big, []), 25);

// Seen set: counts only keys not seen; opening marks all; a new chat line (new lastAt) is new again.
assert.equal(unseenCount(items, []), items.length);
const seen = markSeen([], items);
assert.equal(unseenCount(items, seen), 0);
assert.equal(markSeen(seen, items), seen); // nothing new: the same array back
const later = buildNotifications({ uid: me, chats: [{ ...chats[0], lastAt: 999 }], reads });
assert.equal(unseenCount(later, seen), 1);

// The seen set is capped to the newest MAX_SEEN keys.
assert.equal(MAX_SEEN, 200);
const flood = markSeen(Array.from({ length: 199 }, (_, i) => `old${i}`), [{ key: "n1" }, { key: "n2" }, { key: "n3" }]);
assert.equal(flood.length, 200);
assert.deepEqual(flood.slice(-3), ["n1", "n2", "n3"]);
assert.equal(flood.includes("old0"), false);

console.log("notifications.check: ok");
```

- [ ] **Step 2: Run the check to verify it fails**

Run: `node src/utils/notifications.check.mjs`
Expected: FAIL with `Cannot find module` for `./notifications.js`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/notifications.js`:

```js
// The notifications bell's list, worked out from data the app already holds (friend requests, the inbox, active
// games) plus the join requests of the clubs the person runs. Pure: no Firestore here, the hooks read the data.
import { friendBuckets } from "./friends.js";
import { isUnread } from "./chat.js";

export const MAX_ITEMS = 20;
export const MAX_SEEN = 200;
const GROUP = { turn: 0, friend: 1, join: 2, chat: 3 };

// Item = { key, kind, title, sub, to, at }. `key` names what makes it new (a new chat line has a new key).
export function buildNotifications({ uid, friendships = [], chats = [], reads = {}, joinRequests = [], activeGames = [] }) {
  const items = [];

  activeGames.forEach((g) => {
    const s = g.status; // a game the person only hosts has no status, so no turn
    if (!s) return;
    const playing = s.state === "playing";
    if (!playing && !s.upNext) return;
    items.push({
      key: `turn:${g.club.id}/${g.event.id}:${playing ? "playing" : "next"}`, kind: "turn",
      title: playing ? `You're on Court ${s.court}` : `You're up next${s.nextOn ? ` on Court ${s.nextOn}` : ""}`,
      sub: g.club.clubName, to: g.queuePath, at: 0,
    });
  });

  friendBuckets(friendships, uid).received.forEach((f) => {
    items.push({ key: `friend:${f.id || f.users.join("_")}`, kind: "friend", title: `${f.name} sent you a friend request`, sub: "", to: "/friends", at: 0 });
  });

  joinRequests.forEach((r) => {
    items.push({
      key: `join:${r.clubId}:${r.id}`, kind: "join", title: `${r.name} asked to join ${r.clubName}`, sub: "",
      to: `/clubs/${encodeURIComponent(r.clubId)}/members`, at: r.createdAt || 0,
    });
  });

  chats.filter((c) => isUnread(c, reads[c.id]?.at, uid)).forEach((c) => {
    items.push({
      key: `chat:${c.id}:${c.lastAt}`, kind: "chat",
      title: c.kind === "dm" ? `${c.names?.[c.lastBy] || "Someone"} sent you a message` : `New message in ${c.title || "your club"}`,
      sub: c.lastText || "", to: `/inbox/${encodeURIComponent(c.id)}`, at: c.lastAt || 0,
    });
  });

  return items.sort((a, b) => GROUP[a.kind] - GROUP[b.kind] || b.at - a.at);
}

// The panel shows the first MAX_ITEMS; `more` is how many were left out.
export const capItems = (items) => ({ shown: items.slice(0, MAX_ITEMS), more: Math.max(0, items.length - MAX_ITEMS) });

// `seen` is an array of keys, oldest first (it is kept on the device).
export const unseenCount = (items, seen) => {
  const known = new Set(seen);
  return items.filter((i) => !known.has(i.key)).length;
};

// Adds every current key. Returns the same array when nothing is new, so a caller can skip the write.
export function markSeen(seen, items) {
  const known = new Set(seen);
  const fresh = items.map((i) => i.key).filter((k) => !known.has(k));
  return fresh.length ? [...seen, ...fresh].slice(-MAX_SEEN) : seen;
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `node src/utils/notifications.check.mjs`
Expected: `notifications.check: ok`

- [ ] **Step 5: Commit**

```bash
git add src/utils/notifications.js src/utils/notifications.check.mjs
git commit -m "feat: notification list logic (turn, friend, join, chat items, cap, seen set)"
```

---

### Task 2: Bell, join-request listener and wiring

**Files:**
- Create: `src/hooks/useManagerJoinRequests.js`
- Create: `src/components/NotificationBell.jsx`
- Modify: `src/components/AccountSidebar.jsx` (prop list at line 11, topbar at line 41-43)
- Modify: `src/AccountApp.jsx` (imports; after `const activeGame` near line 52; the `<ClubApp ... />` at line 105; the `<AccountSidebar ... />` at line 113)
- Modify: `src/ClubApp.jsx` (component signature at line 59; the `sidebar` function at line 174)
- Modify: `src/clubs.css`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `buildNotifications`, `capItems`, `unseenCount`, `markSeen` from Task 1; `useEscape` from `src/hooks/useEscape.js`; `clubs` (memberships `{ id, clubName, role }`), `friendships`, `inbox` (`{ chats, reads, unread }`), `activeGames` already in `AccountApp`.
- Produces: `useManagerJoinRequests(uid, clubs) -> JoinRequest[]` (`{ id, clubId, clubName, name, createdAt }`); `<NotificationBell items navigate />`; `AccountSidebar` accepts `notifications` (an `Item[]`, default `null` = no bell); `ClubApp` accepts `notifications`.

- [ ] **Step 1: Create the join-request hook**

Create `src/hooks/useManagerJoinRequests.js`:

```js
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// Pending join requests of every club the person owns or manages, for the notifications bell. One listener per club
// (the same query as useJoinRequests). A refused listener just contributes nothing; the others still work.
export function useManagerJoinRequests(uid, clubs) {
  const [byClub, setByClub] = useState({});
  const managedKey = JSON.stringify(clubs.filter((c) => c.role === "owner" || c.role === "manager").map((c) => [c.id, c.clubName]));

  useEffect(() => {
    setByClub({});
    const managed = JSON.parse(managedKey);
    if (!uid || !firebaseConfigured || !managed.length) return undefined;
    const stops = managed.map(([clubId, clubName]) => onSnapshot(
      query(collection(db, "clubs", clubId, "joinRequests"), where("status", "==", "pending")),
      (s) => setByClub((prev) => ({
        ...prev,
        [clubId]: s.docs.map((d) => ({ id: d.id, clubId, clubName, name: d.data().name || "Someone", createdAt: d.data().createdAt || 0 })),
      })),
      () => setByClub((prev) => ({ ...prev, [clubId]: [] })),
    ));
    return () => stops.forEach((stop) => stop());
  }, [uid, managedKey]);

  return useMemo(() => Object.values(byClub).flat(), [byClub]);
}
```

- [ ] **Step 2: Create the bell component**

Create `src/components/NotificationBell.jsx`:

```jsx
import { useEffect, useRef, useState } from "react";
import { Bell, MessageSquare, Play, UserPlus, Users } from "lucide-react";
import { useEscape } from "../hooks/useEscape";
import { capItems, markSeen, unseenCount } from "../utils/notifications";

const SEEN_KEY = "courtflow.notifSeen";
const ICONS = { turn: Play, friend: UserPlus, join: Users, chat: MessageSquare };

// "Seen" lives on this device. Blocked or full storage just means everything counts as new.
const readSeen = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY));
    return Array.isArray(v) ? v.filter((k) => typeof k === "string") : [];
  } catch { return []; }
};
const writeSeen = (seen) => {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* not remembered */ }
};

function Panel({ shown, more, top, navigate, close, onEscape }) {
  useEscape(onEscape);
  const go = (to) => (e) => { e.preventDefault(); close(); navigate(to); };
  return (
    <div className="acct-bell-panel" role="region" aria-label="Notifications" style={{ "--bell-top": `${top}px` }}>
      {shown.length ? (
        <ul>
          {shown.map((n) => {
            const Icon = ICONS[n.kind];
            return (
              <li key={n.key}>
                <a className="acct-bell-row" href={n.to} onClick={go(n.to)}>
                  <span className={`acct-bell-icon ${n.kind}`}><Icon size={16} aria-hidden="true" /></span>
                  <span className="acct-bell-text"><b>{n.title}</b>{n.sub && <small>{n.sub}</small>}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="acct-bell-empty">You're all caught up.</p>
      )}
      {more > 0 && <a className="acct-bell-more" href="/inbox" onClick={go("/inbox")}>and {more} more</a>}
    </div>
  );
}

export default function NotificationBell({ items, navigate }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(60);
  const [seen, setSeen] = useState(readSeen);
  const root = useRef(null);
  const button = useRef(null);
  const unseen = unseenCount(items, seen);
  const { shown, more } = capItems(items);

  // Opening marks everything seen; new items that arrive while it is open are marked too.
  useEffect(() => {
    if (!open) return;
    setSeen((cur) => {
      const next = markSeen(cur, items);
      if (next !== cur) writeSeen(next);
      return next;
    });
  }, [open, items]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const toggle = () => {
    if (!open && button.current) setTop(Math.round(button.current.getBoundingClientRect().bottom) + 8); // the phone sheet hangs from here
    setOpen((o) => !o);
  };

  return (
    <div className="acct-bell" ref={root}>
      <button
        type="button" ref={button} className="acct-bell-btn" aria-haspopup="true" aria-expanded={open}
        aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"} onClick={toggle}
      >
        <Bell size={19} aria-hidden="true" />
        {unseen > 0 && <span className="acct-bell-badge" aria-hidden="true">{unseen > 9 ? "9+" : unseen}</span>}
      </button>
      <span className="acct-bell-live" aria-live="polite">{unseen ? `${unseen} new notifications` : ""}</span>
      {open && (
        <Panel
          shown={shown} more={more} top={top} navigate={navigate} close={() => setOpen(false)}
          onEscape={() => { setOpen(false); button.current?.focus(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Render the bell in the top bar**

In `src/components/AccountSidebar.jsx`: add the import after the `AccountMenu` import:

```jsx
import NotificationBell from "./NotificationBell";
```

Add `notifications = null` to the props (after `headerAction = null`):

```jsx
export default function AccountSidebar({ active, name, email, onSignOut, navigate, clubs = [], club = null, friendRequests = 0, inboxUnread = 0, headerAction = null, notifications = null }) {
```

Render the bell right before `<AccountMenu ... />`:

```jsx
        {headerAction}
        {notifications && <NotificationBell items={notifications} navigate={navigate} />}
        <AccountMenu name={name} email={email} onSignOut={onSignOut} navigate={navigate} />
```

- [ ] **Step 4: Build the items in `AccountApp` and pass them down**

In `src/AccountApp.jsx`: add `useMemo` to the React import (it imports `useRef, useState` from "react"), then add:

```jsx
import { useManagerJoinRequests } from "./hooks/useManagerJoinRequests";
import { buildNotifications } from "./utils/notifications";
```

Right after the line `const activeGame = activeGames.find((g) => g.status) || activeGames[0]; // a game you play in first, else one you host`, add (it must stay above the early returns):

```jsx
  const managerRequests = useManagerJoinRequests(uid, clubs);
  const notifications = useMemo(
    () => buildNotifications({ uid, friendships, chats: inbox.chats, reads: inbox.reads, joinRequests: managerRequests, activeGames }),
    [uid, friendships, inbox.chats, inbox.reads, managerRequests, activeGames],
  );
```

Pass it to both consumers: on the `<ClubApp ... activeGame={activeGame} />` line add ` notifications={notifications}`, and on `<AccountSidebar` add `notifications={notifications}` next to `headerAction={gameShortcut}`.

In `src/ClubApp.jsx`: change the signature to include `notifications`:

```jsx
export default function ClubApp({ acct, clubId, route, eventId, navigate, inbox, activeGame, notifications }) {
```

and in the `sidebar` function add `notifications={notifications}` next to `headerAction={headerAction}`.

- [ ] **Step 5: Add the styles**

Append to `src/clubs.css`:

```css
/* Notifications bell in the sticky header, just left of the account menu. */
.acct-bell{position:relative;margin-left:auto;display:flex}
.acct-bell+.account-menu{margin-left:0}
.acct-bell-btn{position:relative;display:inline-grid;place-items:center;width:44px;height:44px;border:1px solid var(--card-line);border-radius:12px;background:var(--panel);color:var(--ink);box-shadow:none}
.acct-bell-btn:hover{background:var(--soft)}
.acct-bell-btn[aria-expanded="true"]{border-color:var(--accent-line);background:var(--accent-soft)}
.acct-bell-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.acct-bell-badge{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border:2px solid var(--bg);border-radius:99px;background:var(--accent);color:var(--on-accent);font:800 11px/16px "DM Sans",system-ui,sans-serif;text-align:center}
.acct-bell-live{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.acct-bell-panel{position:absolute;top:calc(100% + 8px);right:0;z-index:40;width:min(360px,calc(100vw - 20px));max-height:min(70vh,520px);overflow-y:auto;padding:6px;border:1px solid var(--card-line);border-radius:16px;background:var(--panel);box-shadow:0 20px 50px #0003}
.acct-bell-panel ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.acct-bell-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 12px;border-radius:12px;color:var(--ink);text-decoration:none;transition:background-color .15s ease}
.acct-bell-row:hover,.acct-bell-row:focus-visible{background:var(--accent-soft)}
.acct-bell-row:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.acct-bell-icon{display:inline-grid;place-items:center;flex-shrink:0;width:34px;height:34px;border-radius:50%;background:var(--soft);color:var(--ink-2)}
.acct-bell-icon.turn{background:var(--accent);color:var(--on-accent)}
.acct-bell-text{display:grid;gap:2px;min-width:0}
.acct-bell-text b{font-size:13.5px;line-height:1.3;overflow-wrap:anywhere}
.acct-bell-text small{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.acct-bell-empty{margin:0;padding:22px 12px;text-align:center;font-size:13.5px;color:var(--muted)}
.acct-bell-more{display:block;padding:10px 12px;border-radius:12px;font-size:13px;font-weight:700;color:var(--accent-ink);text-decoration:none}
.acct-bell-more:hover{background:var(--accent-soft)}
@media(max-width:860px){
  .acct-bell-btn{width:40px;height:40px;border-color:#29362e;background:#141d18;color:var(--side-ink)}
  .acct-bell-btn:hover{background:var(--side-hover)}
  .acct-bell-badge{border-color:var(--nav)}
  .acct-bell-panel{position:fixed;top:var(--bell-top,60px);left:10px;right:10px;width:auto}
}
```

- [ ] **Step 6: Build and run the pure check**

Run: `npx vite build --outDir "$TEMP/cf-build"` then `node src/utils/notifications.check.mjs`
Expected: build succeeds (`built in`), check prints `notifications.check: ok`.

- [ ] **Step 7: Browser check on the emulators**

Needs `npm run emulators` and `npm run dev:emu` running and `node scripts/seed-help.mjs` seeded (logins `ann@demo.test`, `bea@demo.test`, `eli@demo.test`, password `password1`; Ann owns Pub Club; its club chat's last line is from Bea). Write `$TEMP/pw/bell.mjs` (Node Playwright, import via `pathToFileURL(".../node_modules/playwright/index.mjs")`; sign in with `getByPlaceholder("you@example.com")`, `getByPlaceholder("Your password")`, then `locator("form").getByRole("button", { name: "Sign in", exact: true }).last()`; wait with `waitForSelector("text=Find session", { state: "attached" })`). Seed through the emulator REST API with header `Authorization: Bearer owner`:

1. Pending join request: PATCH `clubs/pub/joinRequests/jr1` with `{ name: "Jo Request", status: "pending", createdAt: Date.now() }`.
2. Friend request to Ann: PATCH `friendships/{sorted(annUid,beaUid)}` with `users`, `names`, `status: "pending"`, `requestedBy: beaUid` (uids are printed by `seed-help.mjs` and are also the ids of `accounts` docs).

Assert, signed in as Ann at 1240px and at 390px:
- the bell is visible on `/`, `/clubs/find` and `/clubs/pub`, left of the account menu;
- the badge shows 3 or more (join request, friend request, unread club chat) and the aria-label says "Notifications, N new";
- opening the panel lists, in order, the friend request, the join request ("Jo Request asked to join Pub Club"), then the chat ("New message in Pub Club");
- the badge disappears after opening and reappears after seeding a second join request (`jr2`);
- clicking the join-request row lands on `/clubs/pub/members`, the friend row on `/friends`, the chat row on `/inbox/club_pub`;
- Escape closes the panel and focus is on the bell; a click on the page behind closes it;
- no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`) at 390px;
- Review Focus, storage blocked: run once more with `page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); })` and confirm the bell still renders, the badge counts every item, and there is no `pageerror`;
- signed in as Eli (a plain member): no join-request item; the unread chat is listed.

Expected: every assertion prints true and no console errors.

- [ ] **Step 8: Note the feature in `CLAUDE.md`**

Add one bullet to the settings-backlog list (before the "Help page" bullet): the bell (`components/NotificationBell.jsx`), what it lists, that it is computed live from `useActiveGames` / `friendBuckets` / the inbox / `useManagerJoinRequests`, that "seen" is per device in `courtflow.notifSeen`, the pure logic in `utils/notifications.js` with `node src/utils/notifications.check.mjs`, and that booking reminders ("starting soon", "moved up from the waitlist") are step 2 and need a copy of each booking on the account. In the "Saved for later" list, remove the old "Notifications bell" entry (it is now built), keeping the step 2 note.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useManagerJoinRequests.js src/components/NotificationBell.jsx src/components/AccountSidebar.jsx src/AccountApp.jsx src/ClubApp.jsx src/clubs.css CLAUDE.md
git commit -m "feat: notifications bell (friend requests, unread chats, join requests, your turn)"
```
