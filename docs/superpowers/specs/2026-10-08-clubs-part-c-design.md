# Clubs part C: managers

Part C of `2026-10-08-clubs-design.md`. Part B already lets managers approve requests and remove plain members and lets the owner remove a manager. This part lets the owner name and unname managers.

## What it does

- The owner changes a member's role between member and manager from the Members tab (**Make manager** / **Remove manager**, the second with a confirm). Nobody else can, and nobody can be made owner.
- The owner has a second link, the **manager link** (`/clubs/:id?manager=CODE`). Anyone signed in who opens it and taps Join joins as a manager. Resetting it stops old links. Only the owner sees, makes or resets it (a manager who could share it could mint managers).
- Managers are unchanged otherwise: they cannot remove other managers or the owner, cannot change roles, and cannot see the manager link.

## Data

- `clubs/{id}/private/managerInvite` `{code}` (8 characters), owner only. `private/invite` stays managers-only.
- A role change is one batch: `members/{uid}.role` and `accounts/{uid}/memberships/{clubId}.role`.
- A manager-link join is the person's own batch: member record `{role: 'manager', name, joinedAt, inviteCode}` plus their own card.

## Rules

- `members/{uid}` `update`: owner only, not on yourself, current and new role in `member` / `manager`, only `role` changes.
- Card `update` by the owner: only `role` changes, to `member` / `manager`, and equal to the member record's role after the batch (`getAfter`), so the hub and the club can't disagree. A second `update` branch lets a manager replace a stale card while approving (the member record doesn't exist yet).
- `validInviteJoin`: role `member` needs the member code, role `manager` needs the manager code (the rules `get()` the matching document).
- `private/{id}`: one wildcard match so the owner can still list the folder when deleting the club; `invite` is written by managers, `managerInvite` by the owner, each with a code of exactly 8 characters and no other fields.

## Not included

Transferring ownership; telling someone they were promoted; a member who is already in the club using the manager link (the owner uses **Make manager**).

## Tests

`utils/clubs.check.mjs` (`canChangeRole`, `canRemove`, manager `memberRecord` / `inviteUrl`); `tests/membership.test.mjs` (Part C section: roles, card mismatch, manager link, reset); `tests/cascade.test.mjs` (the manager link is deleted with the club). Browser pass: owner, manager and member contexts, promote and demote live.
