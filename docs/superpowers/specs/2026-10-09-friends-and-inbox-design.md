# Friends and Inbox

Two new sidebar places, built in this order because the second uses the first: **Friends** (find people and add them), then **Inbox** (a group chat for each club, and direct messages).

## Friends

- **Finding people.** A person is found by name or by a short friend code. The code is 8 characters (the same alphabet as invite codes) shown on the Profile page with a Copy button; it is easier to share than the account's long user id, and "user id" in the request means this. Searching a name matches the start of the name (case-insensitive) and lists up to 20 people; searching a code finds exactly one.
- **Privacy switch (Profile): "Let people find me by name"**, on by default. Turning it off removes the name listing; the friend code always works, because only someone you gave it to has it. A person never appears to themselves.
- **Adding.** Add friend sends a request. The other person sees it on the Friends page (Requests) and accepts or declines. Accepted friends see each other in a list with a Message button (Inbox) and Remove. Either side can cancel a request or remove a friendship.

### Data

| Path | Fields | Who |
|---|---|---|
| `profiles/{uid}` | `name`, `nameLower` (only while "find me by name" is on) | any signed-in account reads and queries; the owner writes |
| `friendCodes/{code}` | `uid`, `name` | any signed-in account may `get` one code (no list); the owner creates, replaces and deletes |
| `friendships/{a_b}` (the two uids sorted, joined by `_`) | `users: [a, b]`, `names: {uidA, uidB}`, `status` (`pending` / `accepted`), `requestedBy`, `createdAt` | the two people read (query `users array-contains me`); the requester creates `pending`; only the other person changes `pending` to `accepted`; either deletes |

The profile name is copied onto these documents (like the member records) so lists don't need a second read; the owner's name changes update `profiles`, `friendCodes` and their friendships' `names` entry when they edit their name.

## Inbox

- **Club chat.** Each club has one group chat that every member of the club can read and write. A manager turns it on from the club's Members tab ("Start club chat") and can delete any message in it; everyone can delete their own. People who leave or are removed lose it at once (the rules check the member record).
- **Direct messages.** Between two friends, or between two members of the same club (the **Message** button on the Members list). A direct message is a conversation of exactly two people.
- **The Inbox page.** Left: the list (club chats first, then direct messages, newest first, with the last line and an unread dot). Right: the open conversation with the message box. On a phone the list and the conversation are two screens. The sidebar's Inbox shows the unread count.
- **Messages.** Text only, 1 to 1000 characters, plain (never HTML), in order of time sent. Real time while the page is open. No push notifications and no email.

### Data

| Path | Fields | Who |
|---|---|---|
| `chats/{chatId}` | `kind` (`club` / `dm`), `clubId` (club chat) or `members: [a, b]` (dm; with the optional `viaClub` when they met in a club), `title` (club chat), `lastText`, `lastAt`, `lastBy` | club chat: club members read; a manager creates it (id `club_{clubId}`); dm: the two people read and either creates (id from the sorted uids) |
| `chats/{chatId}/messages/{id}` | `from`, `name`, `text`, `createdAt` | read: as the chat. Create: a person who may read the chat, `from == their uid`, `createdAt` near the server time. Delete: the author, or a manager of the club for a club chat. No edits |
| `accounts/{uid}/chatReads/{chatId}` | `at` | the owner only (it drives the unread dots and the count) |

`lastText` / `lastAt` / `lastBy` are updated in the same batch as each message so the list needs one read per conversation. A direct message may only be created if the two are friends (`friendships` document `accepted`) or both members of `viaClub` (checked with `exists` on both member records).

## Rules summary

- Everything requires a real account (`isRealUser`), never a quick-session user or an old club login.
- Names are 1 to 60 characters; messages 1 to 1000; no extra fields anywhere (`hasOnly`).
- Friend requests and chats can't be addressed to yourself.
- Each rule gets an emulator test for a stranger, a signed-out visitor, a quick-session user, a friend, a non-friend, a club member and a manager.

## Account and club deletion

- Deleting an account removes its `profiles`, `friendCodes`, `chatReads`, its friendships, and the direct-message conversations it is in (the conversation and its messages). Its messages in a club chat stay, under the name they were sent with.
- Deleting a club removes its chat and messages (the owner's cascade, like the other club subcollections).

## Known limits (accepted)

- **The name directory can be paged through.** Rules can't require a search prefix, so a signed-in person can read every opted-in profile in pages of 20 (names and account ids only, no emails); the 2-letter minimum is in the app, not the rules. People who don't want this turn off "Let people find me by name". If the directory ever needs to resist that, search moves behind a Cloud Function.
- **No block list.** Someone who declines a request can be asked again at once. The rules can't rate-limit.
- **Two tabs on a brand-new account** can each pick a friend code; one code document is left behind (it holds only the account id and name). Account deletion removes the stored code only.

## Not included (said plainly)

- **Blocking and reporting.** Remove a friend and leave a direct conversation (hide it) are in; a block list is not. A club manager moderates the club chat; a direct message has no moderator. This is the main risk to decide on before opening it to the public.
- Typing indicators, read receipts, attachments, images, message edit, push or email notifications, and group chats that aren't a club's.
- Search by email (emails stay private).

## Build order and size

1. **Friends** (profile switch and code, directory writes, search, requests and list; rules and tests). Own plan.
2. **Inbox: club chat and the page** (rules, list, conversation, unread, sidebar count, delete cascade). Own plan.
3. **Inbox: direct messages** (friend Message button, member Message button, the friendship/club check). Own plan.

Each is shippable on its own; Friends has no use until a person finds someone, and chat has none without a club, so both are built to behave sensibly when empty ("No friends yet. Search by name or friend code.").
