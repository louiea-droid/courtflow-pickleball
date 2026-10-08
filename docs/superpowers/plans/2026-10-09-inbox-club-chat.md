# Inbox: Club Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** An Inbox page in the sidebar with a group chat for each club (every member reads and writes it, a manager turns it on and moderates it), with unread dots and a sidebar count.

**Architecture:** `chats/club_{clubId}` holds the chat's last line; its messages live in `chats/{id}/messages`. Rules decide access from the club's member records, so leaving or being removed ends access at once. Each person's read position is `accounts/{uid}/chatReads/{chatId}` (already owner-only). The Inbox page is a list plus a conversation (two panes on desktop, one at a time on a phone). Direct messages reuse all of it in the next plan.

**Tech Stack:** React 19, Firebase Firestore, node `*.check.mjs` checks, rules tests (`npm run test:rules`, emulator).

**Spec:** `docs/superpowers/specs/2026-10-09-friends-and-inbox-design.md` (Inbox part). Direct messages are `2026-10-09-inbox-direct-messages.md`, built after this and after Friends.

## Global Constraints

- Real accounts only (`isRealUser()`); never quick-session or old club logins.
- Messages are plain text, 1 to 1000 characters; rendered as text, never as HTML. Names 1 to 60. `hasOnly` on every document.
- Tokens for colors, new CSS in `src/clubs.css` only; sentence case; no avatar-initial badges next to names.
- No push, no email: real time while the page is open.
- The working tree has someone else's uncommitted theme edits. Commit only your own changes: for a file that holds their hunks stage a blob made from `HEAD` plus your edit, and build the index tree before each commit (`git checkout-index -a --prefix=$TEMP/headtree/`, link `node_modules`, `npx vite build`). See memory `active-queue-and-sidebar`.

## Review Focus

1. A removed or departed member: can't read, write or list the club chat or its messages the next second (rules read the member record every time).
2. A plain member can't create the chat, delete someone else's message, edit any message, or rewrite the chat's title or club.
3. A message with another person's uid or name in `from` / `name`, a 1001-character message, an empty one, a back-dated `createdAt`.
4. Opening a chat marks it read; a message you sent never makes your own dot; a person in several clubs sees a correct count.
5. A club that is deleted takes its chat and every message with it, including for a message author who has already left.

---

### Task 1: Pure helpers (`utils/chat.js`)

**Files:**
- Create: `src/utils/chat.js`, `src/utils/chat.check.mjs`

**Interfaces (produces):**
- `MESSAGE_MAX = 1000`; `clubChatId(clubId)` → `club_${clubId}`; `clubIdOfChat(chatId)` → the club id or `null`.
- `validateMessage(text)` → `""` or a message ("Write a message first." / "Messages can be up to 1000 characters.").
- `messageDoc(uid, name, text, now)` → `{ from, name (trimmed, max 60, "Member" if empty), text (trimmed), createdAt }`.
- `chatPreview(text)` → one line (newlines to spaces) cut to 100 characters.
- `chatTail(uid, text, now)` → `{ lastText: chatPreview(text), lastAt: now, lastBy: uid }`.
- `isUnread(chat, readAt, uid)` → `chat.lastAt > (readAt || 0) && chat.lastBy !== uid`.
- `sortChats(chats)` → club chats first (by title), then the rest by `lastAt` descending.
- `unreadCount(chats, reads, uid)` → how many chats are unread (`reads` is `{ [chatId]: { at } }`).

- [ ] **Step 1: Write the failing check** (`node src/utils/chat.check.mjs`):

```js
import assert from "node:assert/strict";
import { MESSAGE_MAX, chatPreview, chatTail, clubChatId, clubIdOfChat, isUnread, messageDoc, sortChats, unreadCount, validateMessage } from "./chat.js";

assert.equal(MESSAGE_MAX, 1000);
assert.equal(clubChatId("abc"), "club_abc");
assert.equal(clubIdOfChat("club_abc"), "abc");
assert.equal(clubIdOfChat("dm_a_b"), null);
assert.equal(clubIdOfChat("club_"), null);

assert.equal(validateMessage("hi"), "");
assert.equal(validateMessage("   "), "Write a message first.");
assert.equal(validateMessage(""), "Write a message first.");
assert.equal(validateMessage("x".repeat(1000)), "");
assert.equal(validateMessage("x".repeat(1001)), "Messages can be up to 1000 characters.");
assert.equal(validateMessage("  " + "x".repeat(1000) + "  "), ""); // trimmed first

assert.deepEqual(messageDoc("u1", "  Sam ", "  hello  ", 5), { from: "u1", name: "Sam", text: "hello", createdAt: 5 });
assert.equal(messageDoc("u1", "", "x", 1).name, "Member");
assert.equal(messageDoc("u1", "n".repeat(80), "x", 1).name.length, 60);

assert.equal(chatPreview("a\nb\n\nc"), "a b c");
assert.equal(chatPreview("x".repeat(150)).length, 100);
assert.deepEqual(chatTail("u1", "hi there", 9), { lastText: "hi there", lastAt: 9, lastBy: "u1" });

assert.equal(isUnread({ lastAt: 10, lastBy: "u2" }, 5, "u1"), true);
assert.equal(isUnread({ lastAt: 10, lastBy: "u2" }, 10, "u1"), false);   // read at the same moment
assert.equal(isUnread({ lastAt: 10, lastBy: "u1" }, 0, "u1"), false);    // your own message
assert.equal(isUnread({ lastAt: 0, lastBy: "" }, 0, "u1"), false);       // an empty chat
assert.equal(isUnread({ lastAt: 10, lastBy: "u2" }, undefined, "u1"), true);

const chats = [
  { id: "dm_a_b", kind: "dm", lastAt: 5 }, { id: "dm_a_c", kind: "dm", lastAt: 9 },
  { id: "club_z", kind: "club", title: "Zed Club", lastAt: 1 }, { id: "club_a", kind: "club", title: "Ace Club", lastAt: 0 },
];
assert.deepEqual(sortChats(chats).map((c) => c.id), ["club_a", "club_z", "dm_a_c", "dm_a_b"]);
assert.equal(unreadCount([{ id: "c1", lastAt: 9, lastBy: "u2" }, { id: "c2", lastAt: 9, lastBy: "u2" }, { id: "c3", lastAt: 9, lastBy: "u1" }], { c2: { at: 9 } }, "u1"), 1);
console.log("chat.check: ok");
```

- [ ] **Step 2: Run it.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/utils/chat.js` to the interface above.
- [ ] **Step 4: Run again.** Expected: `chat.check: ok`.
- [ ] **Step 5: Commit.**

---

### Task 2: Rules and their tests (club chat)

**Files:**
- Modify: `firestore.rules`, `package.json` (`test:rules` also runs `tests/chat.test.mjs`)
- Create: `tests/chat.test.mjs`

- [ ] **Step 1: Write the failing tests** (same setup as `tests/membership.test.mjs`: seed clubs `pub` and `priv` with owner `own`, manager `mgr`, members `mem`, `mem2`; people `stranger`, `anon`, `quick`, `legacy`):
  - Chat doc `chats/club_pub` `{ kind: "club", clubId: "pub", title: "Pub", lastText: "", lastAt: 0, lastBy: "", createdAt: now }`: created by `mgr` and `own` → ok; by `mem`, a stranger, anonymous, quick, legacy → fail; wrong id (`club_other` with `clubId: "pub"`), `kind: "dm"` with a `clubId`, an extra field, a title over 60 → fail.
  - Read (get and `getDocs(collection(.../messages))`): `mem`, `mgr`, `own` ok; a stranger, anonymous, quick, legacy fail; a member of `pub` can't read `club_priv`.
  - Chat update (`lastText`, `lastAt`, `lastBy` only, `lastBy == uid`, `lastAt` near now, `lastText` ≤ 100): `mem` ok; `lastBy` someone else, other fields (`title`, `clubId`, `kind`), stale `lastAt` → fail; a stranger fails.
  - Messages `chats/club_pub/messages/{id}` `{ from, name, text, createdAt }`: `mem` creates with their own uid → ok; `from` another uid, empty text, 1001-character text, extra field, `createdAt` back-dated by a day, name over 60 → fail; a stranger and the three non-real kinds fail. **A removed member**: delete `mem`'s member record (rules disabled) then their read and create both fail.
  - Message update: nobody (author, manager, owner) → fail. Delete: the author ok; a manager ok; another plain member fails; a stranger fails.
  - Chat delete: owner ok; manager and member fail.
  - `accounts/{uid}/chatReads/{chatId}`: the owner writes `{ at }`; another person can't read or write it (already true; assert it).
- [ ] **Step 2: Run** `firebase emulators:exec --only firestore --project rules-test "node tests/chat.test.mjs"`. Expected: FAIL.
- [ ] **Step 3: Implement** in `firestore.rules`:

```
    // ---- Chats. A club's group chat is club_{clubId}: every member reads and writes it, a manager starts it and
    // moderates it. (Direct messages are added by the next plan.) Access follows the club's member record on every request.
    function chatClub(chatId) { return get(/databases/$(database)/documents/chats/$(chatId)).data.clubId; }
    function validTail(d) {
      return d.lastText is string && d.lastText.size() <= 100 && d.lastBy == request.auth.uid && nearNow(d.lastAt);
    }
    match /chats/{chatId} {
      allow get: if isRealUser() && resource.data.kind == 'club' && isMember(resource.data.clubId);
      allow list: if isRealUser() && resource.data.kind == 'club' && isMember(resource.data.clubId);
      allow create: if isRealUser() && request.resource.data.kind == 'club'
        && request.resource.data.keys().hasOnly(['kind', 'clubId', 'title', 'lastText', 'lastAt', 'lastBy', 'createdAt'])
        && chatId == 'club_' + request.resource.data.clubId
        && isManager(request.resource.data.clubId)
        && validName(request.resource.data.title)
        && request.resource.data.lastText == '' && request.resource.data.lastAt == 0 && request.resource.data.lastBy == ''
        && nearNow(request.resource.data.createdAt);
      allow update: if isRealUser() && resource.data.kind == 'club' && isMember(resource.data.clubId)
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['lastText', 'lastAt', 'lastBy'])
        && validTail(request.resource.data);
      allow delete: if isRealUser() && resource.data.kind == 'club' && isOwner(resource.data.clubId);

      match /messages/{id} {
        allow read: if isRealUser() && isMember(chatClub(chatId));
        allow create: if isRealUser() && isMember(chatClub(chatId))
          && request.resource.data.keys().hasOnly(['from', 'name', 'text', 'createdAt'])
          && request.resource.data.from == request.auth.uid
          && validName(request.resource.data.name)
          && request.resource.data.text is string && request.resource.data.text.size() >= 1 && request.resource.data.text.size() <= 1000
          && nearNow(request.resource.data.createdAt);
        allow delete: if isRealUser() && (resource.data.from == request.auth.uid || isManager(chatClub(chatId)));
      }
    }
```
  (Note the `get` rule uses `resource.data`; a read of a chat that doesn't exist yet is refused by the rules, so the client reads the chat only after a manager starts it, or treats a permission error as "no chat". If listing a missing document errors in the emulator, switch the club-chat lookup to a single `getDoc` and map "permission-denied" to `null`.) Add `tests/chat.test.mjs` to the `test:rules` script.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: five suites pass (rules, cascade, membership, friends if built, chat).
- [ ] **Step 5: Commit.**

---

### Task 3: Hooks and actions

**Files:**
- Create: `src/hooks/useChats.js`, `src/hooks/useChatActions.js`

**Interfaces:**
- `useInbox(uid, clubs)` → `{ chats, reads, ready, unread }`: for each of the person's clubs a listener on the document `chats/club_{id}` (missing or refused → none), plus a listener on `accounts/{uid}/chatReads` (`reads` = `{ [chatId]: { at } }`); `chats` is `sortChats` of what exists, each with `id`, `kind`, `title` (from the club's card name), `clubId`, `lastText`, `lastAt`, `lastBy`; `unread = unreadCount(chats, reads, uid)`. (The DM plan adds a direct-message query here.)
- `useMessages(chatId)` → `{ messages, ready }`: last 100, `orderBy("createdAt", "desc")` + `limit(100)`, returned oldest first. (ponytail: older messages aren't loadable; add "Load older" with a cursor when a chat outgrows 100.)
- `useChatActions({ uid, name })` → `sendMessage(chat, text)` (validates with `validateMessage`; one `writeBatch`: `messages/{autoId}` = `messageDoc(...)` and `update` of the chat with `chatTail(...)`), `deleteMessage(chatId, messageId)`, `markRead(chatId)` (`setDoc(accounts/{uid}/chatReads/{chatId}, { at: Date.now() })`), `startClubChat(club)` (`setDoc(chats/club_{id}, { kind, clubId, title: club.name, lastText: "", lastAt: 0, lastBy: "", createdAt })`). Every one rejects on failure.

- [ ] **Step 1:** Implement, following `hooks/useMembership.js` conventions (`firebaseConfigured` guard, error callbacks → empty).
- [ ] **Step 2: Verify** `npm run build` and `node src/utils/chat.check.mjs`. Commit.

---

### Task 4: The Inbox page, route and sidebar entry

**Files:**
- Create: `src/views/Inbox.jsx`, `src/components/ChatPane.jsx`
- Modify: `src/utils/route.js`, `src/utils/route.check.mjs`, `src/hooks/useRoute.js`, `src/AccountApp.jsx`, `src/ClubApp.jsx`, `src/components/AccountSidebar.jsx`, `src/clubs.css` (stage `AccountApp.jsx` / `ClubApp.jsx` / `useRoute.js` carefully with the HEAD-blob method)

- [ ] **Step 1: Failing check:** `routeOf("/inbox")` → `"inbox"`, `routeOf("/inbox/club_abc")` → `"inbox"` (the chat is a parameter, not a separate screen name), and a new `chatIdOf("/inbox/club_abc")` → `"club_abc"`, `chatIdOf("/inbox")` → `null`, `chatIdOf("/inbox/a%20b/")` → `"a b"`. Run → FAIL; implement in `route.js`; `useRoute` returns `chatId`.
- [ ] **Step 2:** `Inbox.jsx`: `PageTitle` "Inbox". Desktop: a list on the left (320px) and the conversation on the right; under 860px only one is shown (the list at `/inbox`, the conversation at `/inbox/:chatId` with a back arrow). List rows: title, last line (`lastText`, with "You: " when `lastBy` is the person), time (`formatClock`-style short time), an unread dot (`isUnread`) with a screen-reader "Unread"; empty state "No conversations yet. A club's chat appears here once a manager starts it." A chat the person can no longer read shows "This chat isn't available." with a link back.
- [ ] **Step 3:** `ChatPane.jsx`: header (title, member-only note), message list (name in bold, text as plain text with `white-space: pre-wrap`, short time; own messages marked "You"; manager gets a delete (trash) button per message with a confirm dialog; authors can delete their own), scrolls to the bottom on open and on a new message when already near the bottom, a composer (textarea; Enter sends, Shift+Enter inserts a newline; counter shown after 900 characters; the Send button disabled while busy or empty; a failure shows an inline alert and keeps the text). Opening the chat and each new message from someone else calls `markRead`.
- [ ] **Step 4:** Sidebar: an **Inbox** item (icon `MessageSquare`) under Play, `active === "inbox"`, with the unread count badge (`inboxUnread` prop; `useInbox` in both `AccountApp` and `ClubApp`, passed down; the Friends badge, if present, uses the same pattern).
- [ ] **Step 5: Verify** route check, `npm run build`. Commit (index tree build first).

---

### Task 5: Club side: start the chat, open it from the Members tab

**Files:**
- Modify: `src/views/ClubMembers.jsx`, `src/ClubApp.jsx`, `src/clubs.css`

- [ ] **Step 1:** Members tab: a **Club chat** block above Everyone. Managers with no chat see "Start club chat" (calls `startClubChat`, then goes to `/inbox/club_{id}`); with a chat, everyone sees "Open club chat" (link). A plain member with no chat sees nothing. The state comes from `useInbox` data already in `ClubApp` (the chat for this club exists when `chats` has `club_{id}`), passed as a prop.
- [ ] **Step 2: Verify** build; browser in Task 6.
- [ ] **Step 3: Commit.**

---

### Task 6: Club deletion, docs, browser pass, review

- [ ] `deleteClubData` (`utils/accountData.js`): before the club doc goes, delete `chats/club_{id}` messages (wipe the subcollection, owner may delete any message in its club's chat: **add `isOwner` of the chat's club to the message delete rule**, since the owner is a manager and already passes `isManager`) and then the chat doc. Extend `tests/cascade.test.mjs` (seed a chat with two messages from different authors, one of whom has left; assert all gone). RED then GREEN. `deleteAccountData`: wipe `accounts/{uid}/chatReads` with the other account subcollections.
- [ ] Browser (emulators, owner + two members, one removed): manager starts the chat from Members; members chat in real time; unread dot and sidebar count appear and clear; the removed member loses access at once; phone layout (list, then conversation, back); manager deletes a message; a 1000-character message and the counter; paste of `<b>x</b>` shows as text.
- [ ] `CLAUDE.md` bullet, memory note, remind the owner to re-publish `firestore.rules`.
- [ ] One whole-branch review (fresh opus reviewer) on the inbox commits; fix Critical and Important with a failing test first.
