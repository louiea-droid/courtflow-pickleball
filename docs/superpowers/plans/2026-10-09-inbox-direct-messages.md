# Inbox: Direct Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** One-to-one messages in the Inbox: from a friend's row on the Friends page, or from a club member's row on the Members tab. A person can hide a conversation.

**Architecture:** A direct message is a chat `chats/dm_{a}_{b}` (the two uids sorted) with `members: [a, b]`, shown in the same Inbox list and conversation pane as the club chat. Creating one is allowed only between accepted friends or between two members of the same club (`viaClub`). Hiding is per person, kept in `accounts/{uid}/chatReads/{chatId}`.

**Tech Stack:** React 19, Firebase Firestore, node `*.check.mjs` checks, rules tests (`npm run test:rules`, emulator).

**Spec:** `docs/superpowers/specs/2026-10-09-friends-and-inbox-design.md`. **Requires** the Friends plan (`2026-10-09-friends.md`) and the club chat plan (`2026-10-09-inbox-club-chat.md`) to be built first.

## Global Constraints

- Same as the club chat plan: real accounts only, plain text 1 to 1000, names 1 to 60, `hasOnly` everywhere, tokens for colors, new CSS in `src/clubs.css`, no avatar-initial badges next to names.
- Commit only your own changes (the working tree holds someone else's theme edits): HEAD-blob staging for any file that has their hunks, and build the index tree before each commit.

## Review Focus

1. A stranger (no friendship, no shared club) can't create a conversation with someone; neither can someone whose friend request is still pending, or who was removed as a friend (the friendship document is gone).
2. Only the two members read or write a direct conversation; a third person, even a manager of a shared club, can't.
3. After unfriending or leaving the shared club an existing conversation stays readable by both people (history), but no new conversation can be started. (Decision: the history belongs to both people; a person who wants out hides it or deletes their account.)
4. Hiding a conversation removes it from that person's list only; a new message from the other person brings it back; the other person never sees that it was hidden.
5. A person can't create a conversation whose `names` entry is someone else's name for them, or with themselves.

---

### Task 1: Pure helpers (extend `utils/chat.js`)

**Files:**
- Modify: `src/utils/chat.js`, `src/utils/chat.check.mjs`

**Interfaces (produces):**
- `dmChatId(a, b)` → `dm_${lo}_${hi}` (uids sorted); `dmChatDoc(me, meName, other, otherName, now, viaClub)` → `{ kind: "dm", members: [lo, hi], names: { [me]: meName, [other]: otherName }, lastText: "", lastAt: 0, lastBy: "", createdAt: now, ...(viaClub ? { viaClub } : {}) }`.
- `otherMember(chat, uid)` → `{ id, name }` of the other person in a dm; `chatTitle(chat, uid)` → the club's `title` or the other person's name.
- `isHidden(readInfo, chat)` → true when `readInfo?.hidden` and `chat.lastAt <= readInfo.at` (a newer message un-hides it).
- `visibleChats(chats, reads)` → `chats` without the hidden ones.

- [ ] **Step 1: Failing check** (add to `chat.check.mjs`):

```js
import { chatTitle, dmChatDoc, dmChatId, isHidden, otherMember, visibleChats } from "./chat.js";
assert.equal(dmChatId("b", "a"), "dm_a_b");
const d = dmChatDoc("b", "Bea", "a", "Al", 7, "club1");
assert.deepEqual(d, { kind: "dm", members: ["a", "b"], names: { b: "Bea", a: "Al" }, lastText: "", lastAt: 0, lastBy: "", createdAt: 7, viaClub: "club1" });
assert.equal("viaClub" in dmChatDoc("b", "Bea", "a", "Al", 7), false);
assert.deepEqual(otherMember(d, "b"), { id: "a", name: "Al" });
assert.deepEqual(otherMember(d, "a"), { id: "b", name: "Bea" });
assert.equal(chatTitle(d, "b"), "Al");
assert.equal(chatTitle({ kind: "club", title: "Ace Club" }, "b"), "Ace Club");
assert.equal(isHidden({ hidden: true, at: 10 }, { lastAt: 10 }), true);
assert.equal(isHidden({ hidden: true, at: 10 }, { lastAt: 11 }), false); // a newer message brings it back
assert.equal(isHidden({ at: 10 }, { lastAt: 1 }), false);
assert.equal(isHidden(undefined, { lastAt: 1 }), false);
assert.deepEqual(visibleChats([{ id: "x", lastAt: 5 }, { id: "y", lastAt: 5 }], { x: { hidden: true, at: 9 } }).map((c) => c.id), ["y"]);
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → ok. **Step 5: Commit.**

---

### Task 2: Rules and tests (direct messages)

**Files:**
- Modify: `firestore.rules`, `tests/chat.test.mjs`

- [ ] **Step 1: Write the failing tests** (extend `tests/chat.test.mjs`; people `me`, `bea`, `cy`; clubs `pub`/`priv` where `me` and `bea` are both members and `cy` is a stranger; seed an `accepted` friendship `me`/`cy`, a `pending` friendship `bea`/`cy`):
  - Create `chats/dm_{a}_{b}`: `me`→`cy` (accepted friends) ok; `me`→`bea` with `viaClub: "pub"` ok; `me`→`bea` without `viaClub` (not friends) fails; `bea`→`cy` (pending) fails; `viaClub` naming a club the two don't share fails; `viaClub` where only one is a member fails; a stranger → anyone fails; yourself fails; unsorted `members` or an id that isn't `dm_lo_hi` fails; `names` missing or over 60 fails; extra field fails; non-zero `lastAt` fails; anonymous, quick, legacy fail.
  - Read (get, list with `where members array-contains me`, messages): the two members ok; a third person, a manager of the shared club, a stranger fail.
  - Chat update: either member sets `lastText`/`lastAt`/`lastBy` (own uid, near now) ok; changing `members`, `names` or `viaClub` fails; a third person fails.
  - Messages: either member creates (own uid) ok; third person fails; either member may delete **any** message in their dm (so deleting an account can clear the conversation); a third person fails; no updates.
  - Chat delete: either member ok; a third person fails.
  - After the friendship document is deleted (rules disabled), the existing conversation is still readable by both and still accepts messages (Review Focus 3), but a *new* `dm` for a different pair that relied on it fails.
- [ ] **Step 2: Run** `firebase emulators:exec --only firestore --project rules-test "node tests/chat.test.mjs"`. Expected: FAIL.
- [ ] **Step 3: Implement** in `firestore.rules`, widening the Task 2 chat rules of the club chat plan (each existing branch gets a `kind` split; the club branch is unchanged):

```
    function dmPath(chatId) { return /databases/$(database)/documents/chats/$(chatId); }
    function inDm(chatId) { return request.auth.uid in get(dmPath(chatId)).data.members; }
    function friendsNow(a, b) {
      return get(/databases/$(database)/documents/friendships/$(a + '_' + b)).data.status == 'accepted';
    }
    function sharedClub(club, a, b) {
      return exists(/databases/$(database)/documents/clubs/$(club)/members/$(a))
        && exists(/databases/$(database)/documents/clubs/$(club)/members/$(b));
    }
    function validDmCreate(chatId, d) {
      return d.keys().hasOnly(['kind', 'members', 'names', 'lastText', 'lastAt', 'lastBy', 'createdAt', 'viaClub'])
        && d.members.size() == 2 && d.members[0] < d.members[1]
        && chatId == 'dm_' + d.members[0] + '_' + d.members[1]
        && request.auth.uid in d.members
        && d.names.keys().hasOnly(d.members) && d.names.keys().hasAll(d.members)
        && validName(d.names[d.members[0]]) && validName(d.names[d.members[1]])
        && d.lastText == '' && d.lastAt == 0 && d.lastBy == '' && nearNow(d.createdAt)
        && (friendsNow(d.members[0], d.members[1])
            || ('viaClub' in d && sharedClub(d.viaClub, d.members[0], d.members[1])));
    }
```
  and: `get`/`list` allow `resource.data.kind == 'dm' && request.auth.uid in resource.data.members`; `create` adds a `kind == 'dm' && validDmCreate(...)` branch (the club `create` keeps `kind == 'club'`); `update` adds a `dm` branch (member, only the three tail keys, `validTail`); `delete` adds a `dm` branch (member). In `messages`: `read`/`create` use `isMember(chatClub(chatId))` for club chats and `inDm(chatId)` for dm chats (branch on `get(dmPath(chatId)).data.kind`); `delete` adds "either member of a dm". Add the doc-level comment that the friendship document is read with `get()`, which a missing friendship turns into a refusal, never an error the client must handle.
- [ ] **Step 4: Run** `npm run test:rules`. Expected: all suites pass.
- [ ] **Step 5: Commit.**

---

### Task 3: Hooks and actions

**Files:**
- Modify: `src/hooks/useChats.js`, `src/hooks/useChatActions.js`

- [ ] **Step 1:** `useInbox` adds one listener: `query(collection(db, "chats"), where("members", "array-contains", uid))` (single field, no index); its documents join `chats` (with `kind: "dm"`, `names`, `members`); `chats` passes through `visibleChats(chats, reads)` and `sortChats`; `unread` ignores hidden chats. `reads` entries may carry `hidden`.
- [ ] **Step 2:** `useChatActions` adds `startDm(other, viaClub)` → resolves to the chat id: `getDoc(dmChatId)`; if it exists, un-hide it (`setDoc chatReads { at: now }`, no `hidden`) and return the id; otherwise `setDoc(chats/{id}, dmChatDoc(...))` (the person's own name from the account, the other's from the row they clicked). `hideChat(chatId)` → `setDoc(chatReads/{id}, { at: Date.now(), hidden: true })`. `sendMessage` already works for any chat; `deleteMessage` is unchanged.
- [ ] **Step 3: Verify** `npm run build`. Commit.

---

### Task 4: Screens

**Files:**
- Modify: `src/views/Inbox.jsx`, `src/components/ChatPane.jsx`, `src/views/Friends.jsx`, `src/views/ClubMembers.jsx`, `src/ClubApp.jsx`, `src/AccountApp.jsx`, `src/clubs.css`

- [ ] **Step 1:** Inbox list and pane use `chatTitle`; a direct conversation's pane header has a **Hide conversation** button (confirm: "It disappears from your list. A new message from them brings it back."); no member note for a dm. The pane's delete (trash) is offered for your own messages and, in a dm, for either person's (confirm).
- [ ] **Step 2:** Friends page: each friend row gets **Message** (`startDm(friend)` then `/inbox/<id>`). Members tab: each other member's row gets **Message** (`startDm(member, clubId)`), except yourself; shown to every member. A failure shows a toast ("Couldn't open the conversation. Try again.").
- [ ] **Step 3: Verify** `npm run build`. Commit.

---

### Task 5: Account deletion, docs, browser pass, review

- [ ] `deleteAccountData`: before the account doc, for every direct conversation the person is in (`where members array-contains uid`): wipe its `messages`, then delete the chat (rules allow either member). Extend `tests/cascade.test.mjs` (a dm with messages from both people; a dm between two other people stays). RED then GREEN. A person's messages in a club chat stay (spec).
- [ ] Browser (emulators, three accounts): message a friend from Friends; message a club member from Members (not friends); a stranger has no Message button anywhere; both sides chat in real time; unread dot and count; hide, then a new message brings it back; unfriend: history stays, can't start a new one with someone you only knew through that friendship; phone layout.
- [ ] `CLAUDE.md` bullet, memory note, remind the owner to re-publish `firestore.rules`.
- [ ] One whole-branch review (fresh opus reviewer) on the dm commits; fix Critical and Important with a failing test first.
