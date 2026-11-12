# Club header, club photos and the club feed

Date: 2026-11-12. Owner-approved mockups: `.superpowers/brainstorm/510-*/content/club-tabs.html` (Overview, Members)
and `club-header-feed.html` (header, feed, Edit club, phone). Part of the CourtWave app redesign; the club's Open play
tab was done first (`views/Host.jsx`, 2026-11-12) and sets the look.

## Why

The club screens still look like the first build: a header with a row of pills and a **Club tools** menu that mixes
things now found elsewhere (Start new and Play now are on the Open play tab, Manage members is the Members tab). The
owner wants a club to look like its own place (its own cover and photo), and wants the club's members talking to each
other: today only managers can post, as announcements. The owner asked for hearts and replies in the first version.

## Goals

1. **Club header** (every club screen, `ClubApp.jsx`):
   - A cover across the top; the club photo overlaps its bottom-left corner.
   - Under the italic name, on one line of plain text with icons: role (lime pill for owner and manager, soft for
     member), Public / Private club, place, member count.
   - The tabs below, underlined in lime as now. **Announcements becomes Feed.**
   - The actions on the right are **Share** and **Edit club**. They replace Club tools.
     - **Share** (everyone): Share booking page. Managers also get Share invite link and Reset invite link (create the
       link when there is none).
     - **Edit club** (owners and managers): opens the Edit club window.
   - Owners and managers also see a camera button on the cover (top right, "Change cover") and on the photo
     (bottom-right corner). Each opens Edit club, or the file picker straight away (builder's choice).
   - With no cover: the club's `badgeColor` with the brand wave. With no photo: the initial badge, as now.
   - Fix while here: `ClubHeaderActions` shows `club.name` in the invite share hint, but `club` isn't a prop there, so
     Share invite link crashes today.
2. **Club photos**:
   - Owners and managers set, change or remove a cover and a square club photo.
   - Photos are shrunk on the device and saved as JPEG data URLs, like booking receipts (`utils/receipt.js`). No
     Firebase Storage, which needs the paid plan.
   - The club photo replaces the initial badge wherever a club badge shows: club header, sidebar "Your clubs", Home,
     Clubs page, Find a game cards, Inbox and chat header, public booking page hero.
3. **Edit club window**:
   - Cover preview with Change cover / remove.
   - The photo with Change photo / Remove.
   - Fields: name, description, place, and public / private (owner only, as now).
   - Save changes / Cancel.
   - The full Settings page stays where it is, in the account menu. Edit club only takes over the club-profile fields
     that Settings already has: same validation, and `updateClub` keeps the club and its events in step for
     visibility.
4. **Feed** (the Announcements tab, renamed; `views/ClubAnnouncements.jsx` grows into it):
   - **Who posts:** every member. Text 1-2000 characters (trimmed, not just spaces) and at most one photo.
   - **Announcement:** a manager or owner can switch **Announcement** on in the post box. An announcement has a lime
     left edge and an "Announcement" tag. It is pinned above the other posts while it is less than 7 days old; after
     that it sits in time order with the rest.
   - **Post header:** author name, then a role tag (Manager / Member; the owner shows as Owner), then the time.
     Names are plain text, no avatars or initials.
   - **Hearts:** one per person per post. Tapping again takes it back. Shows the count, filled when you hearted.
   - **Replies:** one level only, text only (1-1000 characters). The reply count is on the post. Tapping opens the
     replies under the post with a reply box. "Reply" shows when there are none.
   - **Delete:** the author or a manager deletes a post or a reply, from a "⋯" menu, with a confirm. Deleting a post
     deletes its replies and its photo. Nobody edits.
   - **Filters:** All / Announcements chips.
   - **Paging:** the newest 20, then "Load earlier posts".
   - **Side column (wide screens):** About the club (description) and the next game (date, title, spots left).
     Hidden on a phone.
   - **Who reads:** only members, as announcements today.
   - **Empty state:** "No posts *yet.*" on the deep green wave card, with one line inviting the first post.
5. **Overview** (`views/ClubHome.jsx`), as in `club-tabs.html`:
   - **Next game hero:** the next game is a big deep green card on the wave, showing the date tile, title, time, level,
     fee and a fill bar ("6 of 8 booked · 2 spots left"). Managers get **Open event** and **Share booking link**;
     members get **Book a spot** (the booking page on that game). Private clubs have no public booking page
     (`OpenPlay.jsx` turns them away), so there Book a spot, Share booking link and Share booking page are hidden and
     a member's rows have no action (my call after review; a member booking page inside the app is a separate project). While a game is live, this card becomes the Open
     play tab's "Live now" card.
   - **Coming up:** the next 3 games as short rows with a fill bar, and "All open play ›" (managers: the Open play tab;
     members of a public club: the booking page; hidden for members of a private club).
   - **Right column:** three small numbers (members; games this month; players this month = booked seats of this
     month's games), then the latest 3 feed posts with announcements first and a "New" tag on posts under 24 h old,
     and "View all ›" to the Feed.
   - **Phone:** one column.
6. **Members** (`views/ClubMembers.jsx`), as in `club-tabs.html`:
   - **Counts row:** members, managers, waiting to join.
   - **Join requests:** a lime "Waiting for you" card with Approve / Decline.
   - **Invite link strip:** a dark strip with the link, **Copy** and **New link** (managers only). The same actions
     stay in Share.
   - **Everyone:** grouped "Owner & managers", then "Members". A search box shows once there are more than 8. Each row
     has the name, "Joined {date}" and the role pill.
   - **Row actions:** **Message** stays on the row. Make manager / Remove manager / Remove from club move into a "⋯"
     menu (`components/RowMenu.jsx`).
   - **Leave club** stays in the title row for non-owners.

## Non-goals (this version)

- Bell notifications for new posts, replies or hearts. Later.
- Replies to replies, photos in replies, editing posts or replies, other reactions than a heart.
- Photo cropping tools: the cover is center-cropped to its frame by CSS, the club photo center-cropped to a square on
  the device.
- A feed for non-members or the public booking page.
- Push or email.

## Anti-goals

- Photo bytes on documents that get listed in bulk.
  - The club doc is read by Find clubs (up to 200 at a time), so it may carry only a small thumbnail.
  - Events are read by Find a game (100 at a time), so only a tiny copy.
- Any write path that lets a member change someone else's post, a post's heart list beyond their own heart, a reply
  count without a reply, or a club's photos.
- Avatars or initials beside people's names (standing owner rule).

## Data (proposal; the builder may adjust names, not the limits above)

- **Club photo** (my call after review: two sizes, so lists stay light):
  - `photo` on `clubs/{id}`: a 64 x 64 JPEG data URL, under about 6,000 characters. Used by every list and badge
    (Find clubs reads up to 200 clubs: at most about 1.2 MB of thumbnails).
  - `clubs/{id}/media/photo` = `{ image, updatedAt }`: 256 x 256, under about 40,000 characters, read only by the club
    header (the big overlapping photo) and Edit club. Both are written in one batch by Edit club.
  - For event cards, `sessionMeta` copies the same 64 x 64 `photo` onto events as `clubPhoto`,
    like `clubName`. `useSessionSync` repairs old events.
  - Lists that come from `accounts/{uid}/memberships` (sidebar, Home, Inbox) read the club docs they already know the
    ids of. A manager can't write other people's membership cards outside the member-record batch, so the photo isn't
    copied onto cards.
- **Cover:** `clubs/{id}/media/cover` = `{ image, updatedAt }`.
  - A JPEG data URL, up to 1600 px wide, under 380,000 characters (receipt steps).
  - A separate doc, so the club doc stays light; read only by the club header.
  - Readable by whoever can `get` the club; written by managers.
- **Posts:** keep the `clubs/{id}/announcements` collection; the delete cascade already covers it. New fields:
  - `announcement` (bool; managers only). Older docs have no field and count as announcements, since only managers
    could post them.
  - `hasPhoto` (bool).
  - `hearts`: an array of uids. A member may only add or remove their own uid; no other field changes in that write.
  - `replyCount`: changes only by +1 / -1 in the same batch as a reply create / delete, checked with `existsAfter`.
  - `authorRole`: copied from the member record, and checked against it.
- **Post photo:** `announcements/{id}/photo/main` = `{ image }`.
  - Its own doc, loaded when the post is shown, so the feed list stays light.
  - Up to 1280 px, under 380,000 characters.
  - Created by the post's author.
- **Replies:** `announcements/{id}/replies/{rid}` = `{ authorId, authorName, text, createdAt }`.
  - Name checked against the member record, as posts and chat messages are.
- **Delete cascade:** post delete removes `replies` and `photo` first; club delete removes every post's `replies` and
  `photo` and the club's `media` (`deleteClubData`).
- **Account delete** (my call after review, same as club chat): a deleted person's posts, replies and hearts stay in
  clubs they don't own; clubs they own are wiped as today. Likewise a person who left or was removed can no longer
  delete their posts (the rules read the member record, as chat does).
- **Who deletes a reply:** its author, a manager, or the post's author (needed so deleting a post can remove its
  replies; the post author may also tidy replies on their own post).
- **Member count:** counted from the members list. Members can list it, so the header shows the count to members
  only; non-members see no count.
- **Rules:** `firestore.rules` changes. Tests go in a new `tests/feed.test.mjs` plus additions to
  `tests/cascade.test.mjs`. The rules must be re-published in the Firebase console.

## Constraints

- Theme tokens only. Light and dark, phone (390 px) and desktop checked in the browser on the emulators
  (`npm run emulators` + `npm run dev:emu`, seed `scripts/seed-help.mjs`; add posts and photos to the seed).
- Styles in `clubs.css` (club screens), in a new section at the end.
- Pure logic in a `utils/feed.js` with a `node src/utils/feed.check.mjs`: pin order, the 7-day pin, heart toggle,
  "New" under 24 h, role tag.
- Image shrinking reuses `compressImage` (add a size or square option rather than a second copy).
- Tap targets of about 40 px on touch screens (the responsive pass rules).

## Order of work

1. Header + Share / Edit club + club photo and cover (+ the invite crash fix).
2. Feed (posts, announcement pin, photo, hearts, replies, delete, rules + tests).
3. Overview and Members.

Each step ships on its own; the owner checks each in the browser before the next.

## Left to the builder

Component split, hook names, exact JPEG steps within the size limits, the reply UI's open / close animation, whether
the camera buttons open Edit club or the file picker directly, and how many replies show before "Show all replies".
