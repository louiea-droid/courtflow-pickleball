# Clubs part B: joining, members, invite links

Date: 2026-10-08. Status: draft for owner review. Builds on `2026-10-08-clubs-design.md` (approved; part B was only outlined there) and the part A work on branch `feat/accounts-hub`.

## Goal

A signed-in person can find a public club and ask to join it, or join any club with an invite link. Managers approve or decline requests and remove members; members can leave. Everyone who belongs to a club sees its members. Managers (naming and removing them) stay in part C.

Decided earlier with the owner: public directory with search + request/approval; invite link joins right away; resetting the link stops old ones; private clubs are not listed.

## Corrections to the clubs spec

- **No index, and a better search.** The spec said a name-prefix range query needs no index. It does: the rules only allow listing `visibility == 'public'`, so the query is an equality plus a range, which needs a composite index (a console step for the owner). Instead the directory loads the public clubs once (up to 200) and filters them on the device by *contains* on name and location. No index, no console step, and a better search than a prefix. Ceiling: past 200 public clubs, search can miss some; the upgrade path is the composite index and a server-side prefix query.
- **Invite code visibility.** An invite join stores the code on the member record, and members can read member records, so any member can see the current code. Accepted: any member can share the link anyway, and a reset invalidates it.

## Data

| Path | Holds | Read | Write |
|---|---|---|---|
| `clubs/{id}/joinRequests/{uid}` | `name`, `message` (up to 200 characters, optional), `status` (`pending` / `declined`), `createdAt` | the requester, managers | requester creates and deletes (withdraw, dismiss); managers set `declined` and delete |
| `clubs/{id}/private/invite` | `code` (8 characters) | managers | managers (create, reset) |
| `clubs/{id}/members/{uid}` | `role`, `name`, `joinedAt`, and `inviteCode` only on invite joins | members | see Rules |
| `accounts/{uid}/memberships/{clubId}` | unchanged copy (`clubName`, `role`, `joinedAt`) | the person | the person; a manager creates it on approval and deletes it on removal |

The request id is the requester's uid: one request per person per club.

## Rules (additions to `firestore.rules`)

- **Join request create:** a real user, `auth.uid == uid`, the club is public, they are not already a member, fields exactly `name, message?, status, createdAt`, `status == 'pending'`, name 1 to 60 characters, message up to 200, `createdAt` within 10 minutes of server time. Private clubs take no requests (invite only).
- **Join request read and update:** read by the requester and by managers (`list` by managers only). Update by managers, only `status: 'declined'`. Delete by the requester or by managers.
- **Member create, three ways:** (1) the owner's record in the club batch (exists); (2) **invite join:** `auth.uid == uid`, `role == 'member'`, fields exactly `role, name, joinedAt, inviteCode`, and `inviteCode == get(private/invite).data.code` (the rules read the invite document even though the person cannot); (3) **approval:** a manager creates `role == 'member'` with fields `role, name, joinedAt` while `joinRequests/{uid}` exists and is `pending`.
- **Member delete:** the owner removes anyone else, a manager removes plain members, a member removes their own record unless they are the owner, and anyone removes their own record once the club is gone (existing).
- **Membership copies of other people:** a manager may create `accounts/{uid}/memberships/{clubId}` with `role: 'member'` when the same batch creates that member record (`getAfter`), and delete it when the same batch removes the member record (`!existsAfter`). Nothing else is writable by a manager.
- **Club delete cascade:** the owner deletes every other member's copy in the same batch as their member record (allowed by the rule above), so no one keeps a stale "My clubs" card.

Every rule gets an emulator test for a signed-out visitor, an anonymous quick-session user, a stranger, the requester, a member, a manager and the owner, on a public and a private club, including: a second request, a request while already a member, a request to a private club, approval without a request, an old invite code, removing the owner, a member removing someone else.

## Screens

- **Find a club** (`/clubs/find`, opened from a "Find a club" card on the hub): a search box and a list of public clubs (name, location, short description). Each row shows your state: Member, Request sent, or "View club". Rows open the club page.
- **Club page for a non-member** (any signed-in person with the address): the header and description, then one panel:
  - public club: **Request to join** with an optional message; after sending, "Request sent. A manager will review it." with **Withdraw**; if declined, "Your request was declined." with **Dismiss**;
  - `?invite=CODE` in the address: "You're invited to join {club}" with **Join**; a code that no longer matches shows "This invite link is no longer valid. Ask a manager for a new one.";
  - private club with no invite: "This club is private. Ask a manager for an invite link."
  Open play is listed only to people who can see it (public club, or a member); otherwise that panel is not shown (fixes the earlier "No open play scheduled yet" on private clubs).
- **Members** (`/clubs/:id/members`, a new tab): everyone in the club sees the list (name, role, joined date). Plain members also get **Leave club** (not the owner, who is told to delete the club instead). Managers also see, above the list: **Join requests** (name, message, Approve, Decline, with a count badge on the tab), **Invite link** (the link with Copy and Share via the existing share dialog with QR, **Create invite link** when none exists, **Reset invite link**), and **Remove** on plain members (confirmation dialog).
- **Tabs:** managers: Overview, Open play, Members, Settings. Plain members: Overview, Members. Non-members: no tabs.
- **My clubs** shows joined clubs with the "Member" label. A stale card (removed from a club, or the club was deleted) opens "Club not found" with a **Remove from My clubs** button.
- **Account delete** now first leaves every club the person only belongs to (deletes their member record and copy), then deletes clubs they own, as before.

## Code outline

- `utils/clubs.js` (pure, with `clubs.check.mjs`): `newInviteCode`, `inviteUrl(origin, clubId, code)`, `validateJoinMessage`, `filterClubs(clubs, query)`, `memberRecord(name, now, inviteCode?)`, `ROLE_LABEL` reused.
- `utils/route.js`: `/clubs/find` (`clubs-find`) and `/clubs/:id/members` (`club-members`), with `route.check.mjs` cases.
- Hooks: `useDirectory`, `useMembers`, `useJoinRequests` (managers), `useMyJoinRequest`, `useInvite` (managers); `useMembershipActions` (request, withdraw, dismiss, approve, decline, joinWithInvite, leave, removeMember, createOrResetInvite, removeStaleCopy).
- Views: `FindClubs.jsx`, `ClubMembers.jsx`, a `JoinPanel` shown by `ClubHome` for non-members; `ClubApp.jsx` gets the Members tab and passes the invite code from the address.
- `utils/accountData.js`: cascade removes other members' copies; account delete leaves clubs first. `tests/cascade.test.mjs` extended.

## Not in part B

Naming and removing managers and the manager limits (part C), transferring ownership, notifications (managers see a count badge, nobody is emailed), member limits, banning someone who was removed or declined, requests to private clubs, search past 200 public clubs. A deleted account's pending request stays in the club until a manager declines it (no way to find it without a collection-group query).

## Risks

- **Cross-account writes:** managers write other people's membership copies. Mitigation: the rule only allows exactly the two writes that mirror a member record change in the same batch, and has its own tests.
- **Rules cost:** each invite join reads two documents. Accepted at this scale.
- **Invite code seen by members** (above). Accepted; reset invalidates.
- **Rules must be re-published** in the Firebase console before the deployed site can use any of this; the emulator pass needs nothing.

## Testing

Pure checks (`node src/utils/clubs.check.mjs`, `route.check.mjs`), the rules matrix and cascade test (`npm run test:rules`), and a browser pass on the emulators with two or three people: request, approve, decline and dismiss; invite join, reset and the old link failing; leave and remove; directory search; a private club as a non-member and as a member; deleting a club removes other members' cards; account delete as a plain member leaves the club.
