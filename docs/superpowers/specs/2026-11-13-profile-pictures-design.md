# Profile pictures (2026-11-13)

## Why
The owner wants people to have a picture: upload their own or pick a built-in avatar, edited on Settings > Account,
and seen by other people next to their name. This replaces the earlier "plain names only" rule for people who set one.

## Approaches
- **A. One public picture record per person (picked by the owner).** `avatars/{uid}` holds the picture; a `UserAvatar`
  component looks it up once per tab and caches it (same pattern as `ClubBadge`). One write updates every screen.
- B. Copy the picture onto member records, friendships and chats like names. Rejected: many copies to keep in sync.
- Firebase Storage: rejected, needs the paid plan.

## Design
- **Data:** `avatars/{uid}` = `{ image, updatedAt }` (a JPEG data URL, 128 px square, at most 12000 characters, made on the
  device with `compressImage(file, { square: true, ... })`) or `{ builtin, updatedAt }` (`"a1"`..`"a12"`). Removing the
  picture deletes the doc. Rules: `get` for any signed-in real account (`isRealUser`), no `list`; create / update /
  delete only by the owner, keys limited to these, `image` a JPEG data URL within the size, `builtin` from the list.
  Account deletion deletes it (`deleteAccountData`). Rules test in `tests/avatar.test.mjs`. The rules must be published.
- **Built-in avatars:** 12 small inline SVGs in `src/data/avatars.js`, sport-neutral (the owner plans more sports):
  brand palette backgrounds (deep green, green, lime, plus a few accent hues) with simple shapes (waves, circles,
  stripes, a sun). No initials, no faces of real people.
- **Component:** `components/UserAvatar.jsx` (`uid`, `size`, optional `picture` to skip the lookup). No picture = a
  neutral person icon (no initials). Decorative (`aria-hidden`); the name next to it is the label.
- **Editing (Settings > Account band):** the avatar big beside the name with a camera button: **Upload photo**,
  a grid of the 12 built-ins (tap = saved), **Remove**. Toast "Picture updated." / "Picture removed."
- **Where it shows:** account menu trigger and panel, Settings band, Members rows, Friends (friends, requests, search
  results), Inbox list (direct messages), the direct message header, and next to each message in club chats.
  Not the queue or the Live Board (many players there have no account; the board is open to signed-out viewers).

## Non-goals
Pictures in the queue / Live Board, cropping tools (center square crop only), pictures for clubs (exists already).

## Left to the builder
Exact avatar artwork, sizes per place (about 28-32 px in lists, 72 px in Settings), seed data for the demo accounts.
