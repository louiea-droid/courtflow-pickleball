# Club header and club photos (step 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The new club header (cover, overlapping club photo, plain meta line, Share + Edit club instead of Club tools)
and club photos that owners and managers set, shown wherever a club badge shows.

**Architecture:** Photos are JPEG data URLs shrunk on the device. There are three sizes, each stored where only its
readers load it:
- a 64 px thumbnail on the club doc (`photo`), copied onto events as `clubPhoto`;
- a 256 px photo at `clubs/{id}/media/photo`;
- a cover at `clubs/{id}/media/cover`.

One `ClubBadge` component draws a club's photo, or its color and initial, everywhere. It reads the thumbnail from a
shared per-tab cache when the caller doesn't pass one.

**Tech Stack:** React 18 + Vite, Firebase JS SDK (Firestore), `firestore.rules`, `@firebase/rules-unit-testing`,
plain `node` assert checks, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-11-12-club-header-and-feed-design.md` (goals 1-3, Data: club photo and
cover). Mockups: `.superpowers/brainstorm/510-*/content/club-header-feed.html` sections 1, 2, 4, 5. The feed (step 2)
and Overview / Members (step 3) get their own plans.

## Global Constraints

- **Sizes (exact):**
  - thumbnail: 64 x 64 JPEG data URL, ≤ 6,000 characters;
  - club photo: 256 x 256, ≤ 40,000 characters;
  - cover: up to 1600 px wide, ≤ 380,000 characters.
  - All are `data:image/jpeg;base64,...`.
- **Who:** only owners and managers change photos. Anyone who can `get` the club reads `media`.
- **Styling:** theme tokens only, light and dark. New styles go in a section at the end of `src/clubs.css`. Use
  `.outline` for neutral buttons, lime for the one main action. Tap targets are about 40 px on touch screens.
- **People's names stay plain** (no avatars or initials beside people). This is about clubs only.
- **Firebase:** no Storage (paid plan). The rules must be re-published in the Firebase console after this ships.
- **Browser checks:** run them in the visible Playwright window on the emulators (`npm run emulators`,
  `npm run dev:emu`, `node scripts/seed-help.mjs`; login `ann@demo.test` / `password1`, club `pub`), at 390 px and
  1280 px, light and dark.
- **Commits:** only when the owner asks. Each task ends with "stage", not commit.

## Review Focus

1. **A huge or odd file** (a 12 MB phone photo, a PNG screenshot with transparency, a non-image file). Expected: it
   shrinks to the size limit, or a clear error shows ("Choose a picture."); it never saves something the rules refuse
   silently. → Task 1 check (`fitWithin` / limits) and Task 2 rules test (oversize refused).
2. **A member or stranger writing `photo` or `media`.** Expected: refused. → Task 2 rules tests.
3. **Removing a photo** brings back the color and initial everywhere, including events already carrying a
   `clubPhoto` copy. → Task 1 check (`sessionMeta` with no photo gives `clubPhoto: ""`), Task 3 removal batch.
4. **Private club, non-member page load** (invite link): the header must render with no count and without failing on
   `media` reads. → Task 2 rules test (a signed-in non-member can `get` media of a private club, as the club doc
   itself).
5. **Share invite link** used to crash (`club` undefined in `ClubHeaderActions`). → Task 4 browser step opens it.

---

### Task 1: Photo helpers and the event copy

**Files:**
- Create: `src/utils/clubPhoto.js`, `src/utils/clubPhoto.check.mjs`
- Modify: `src/utils/receipt.js` (`compressImage` takes options), `src/utils/sessions.js:11-16,38` (`sessionMeta`,
  `validSession`), `src/utils/sessions.check.mjs`

**Interfaces:**
- Produces:
  - `PHOTO_LIMITS = { thumb: 6000, photo: 40000, cover: 380000 }`
  - `isJpegUrl(value, max) -> boolean`
  - `squareCrop(w, h) -> { sx, sy, size }`, a centered square
  - `PHOTO_STEPS = { thumb: [[64, .8], [64, .6]], photo: [[256, .8], [256, .65], [256, .5]], cover: COMPRESS_STEPS with 1600 first }`
- `compressImage(file, { steps = COMPRESS_STEPS, square = false, max = RECEIPT_MAX, message = "Choose a picture of your receipt." } = {}) -> Promise<string>`.
  The receipt callers stay unchanged.
- `sessionMeta(clubId, club)` gains `clubPhoto: club.photo || ""`.

- [ ] **Step 1: Write the failing check** `src/utils/clubPhoto.check.mjs`:
  - `squareCrop(400, 300)` deep-equals `{ sx: 50, sy: 0, size: 300 }`, and `squareCrop(300, 500)` equals
    `{ sx: 0, sy: 100, size: 300 }`.
  - `isJpegUrl("data:image/jpeg;base64," + "A".repeat(10), 6000)` is true. At length 6001 it is false. A PNG prefix
    is false. A non-string is false.
  - `PHOTO_LIMITS` deep-equals `{ thumb: 6000, photo: 40000, cover: 380000 }`.
  - Add to `sessions.check.mjs`:
    - `sessionMeta("c", { name: "A", visibility: "public" }).clubPhoto === ""`;
    - with `photo: "data:image/jpeg;base64,xx"` it carries the photo;
    - `needsSync({ ...metaWithoutClubPhoto }, meta)` is true.
- [ ] **Step 2: Run them.** Run `node src/utils/clubPhoto.check.mjs && node src/utils/sessions.check.mjs`. Expected:
  fail (module missing, `clubPhoto` undefined).
- [ ] **Step 3: Implement.** Write `clubPhoto.js` (pure; no DOM). Then:
  - `compressImage`: when `square` is set, draw `squareCrop` of the image into a `max x max` square for each step;
    otherwise `fitSize` as now. Accept a result when it starts with the JPEG prefix and is ≤ `max`.
  - `validSession`: add `optional(e.clubPhoto, "string")`.
- [ ] **Step 4: Run them.** Run `node src/utils/clubPhoto.check.mjs && node src/utils/sessions.check.mjs && node src/utils/receipt.check.mjs`.
  Expected: all pass.
- [ ] **Step 5: Stage.**

### Task 2: Rules for club photos, media and the event copy

**Files:**
- Modify: `firestore.rules` (`validClub` ~420, `clubCopyOk` ~455, the events `update` rule ~534, and a new
  `match /media/{id}` under `match /clubs/{clubId}` ~467)
- Modify: `src/utils/accountData.js:10` (`CLUB_SUBCOLLECTIONS` adds `"media"`)
- Create: `tests/clubPhoto.test.mjs`
- Modify: `tests/cascade.test.mjs`, `package.json` (`test:rules` adds `node tests/clubPhoto.test.mjs`)

**Interfaces:**
- Produces:
  - Club doc may carry `photo` (string, JPEG prefix, ≤ 6000) or no `photo` field.
  - `clubs/{id}/media/{photo|cover}` = `{ image, updatedAt }`:
    - read: `resource == null || get(club).visibility == 'public' || isRealUser()`, the same as `get` on the club;
      list is allowed on the same terms;
    - create / update: `isManager(clubId)`, keys exactly `image` and `updatedAt`, a JPEG prefix, size ≤ 40000 for
      `photo` and ≤ 380000 for `cover`, `updatedAt` an int;
    - delete: `isManager`.
  - Event `clubPhoto` must equal `getAfter(club).data.get('photo', '')` when written (inside `clubCopyOk`). It joins
    the `hasAny([...])` list in the update rule.

- [ ] **Step 1: Write the failing test** `tests/clubPhoto.test.mjs`. Set it up like `tests/announcements.test.mjs`:
  clubs `public` and `private`, an owner, a manager and a member, and a `stranger`.
  - **Club doc:**
    - manager `updateDoc(club, { photo: jpeg(100) })` succeeds;
    - member fails;
    - `photo: jpeg(6001)` fails;
    - `photo: "data:image/png;base64,xx"` fails.
  - **Media:**
    - manager `setDoc(media/cover, { image: jpeg(300000), updatedAt: Date.now() })` succeeds; `jpeg(380001)` fails;
    - `media/photo` with `jpeg(40001)` fails;
    - `media/other` fails;
    - member write fails.
  - **Reads:**
    - anonymous `getDoc(public media/cover)` succeeds; anonymous on private fails;
    - stranger (real user) on private succeeds.
  - **Event copy:**
    - manager event create with `clubPhoto` equal to the club's `photo` succeeds; a different string fails;
    - with no club photo, `clubPhoto: ""` succeeds.
  - **Delete:** manager can delete `media/cover`.
  - In `cascade.test.mjs`, seed a `media/cover` and assert it is gone after `deleteClubData`.
  - `jpeg(n)` builds a string of total length `n` with the JPEG prefix.
- [ ] **Step 2: Run** `npm run test:rules`. Expected: the new file fails (writes refused, or reads not matched).
- [ ] **Step 3: Implement the rules and the cascade entry.**
- [ ] **Step 4: Run** `npm run test:rules`. Expected: every file passes, including the old ones (umpire, live,
  sessions, cascade).
- [ ] **Step 5: Stage.**

### Task 3: Data hooks and `ClubBadge`

**Files:**
- Create: `src/components/ClubBadge.jsx`, `src/hooks/useClubMedia.js`
- Modify:
  - `src/hooks/useClubActions.js` (adds `setClubPhoto`, `setClubCover`);
  - `src/hooks/useSessionSync.js:10` (the key includes `club.photo`).

**Interfaces:**
- Consumes: `compressImage`, `PHOTO_STEPS`, `PHOTO_LIMITS` (Task 1).
- Produces:
  - `setClubPhoto(clubId, file | null) -> Promise<void>`:
    - For a file: compress twice (`thumb` square ≤ 6000, `photo` square ≤ 40000). One batch sets `photo` on the club
      and `media/photo` `{ image, updatedAt }`, and updates `clubPhoto` on the club's events (≤ 499; the rest is left
      to `useSessionSync`, with a `ponytail:` note like `updateClub`'s).
    - For `null`: `deleteField()` on `photo`, delete `media/photo`, and set events' `clubPhoto` to `""`.
    - Errors from compressing pass through with the message "Choose a picture." (non-image) or "That picture is too
      large. Try another one."
  - `setClubCover(clubId, file | null) -> Promise<void>`: sets or deletes `media/cover` (`cover` steps, ≤ 380000).
  - `useClubMedia(clubId) -> { cover: string | null, photo: string | null }`: one listener on the `media` collection
    (reuse `useDocs` from `hooks/useLiveDocs.js`).
  - `<ClubBadge id name photo? className />`:
    - Renders `<span className={className} aria-hidden="true">`.
    - With a photo, it shows the photo as a background image (cover, center), with `badgeColor(id)` behind it.
    - Without a photo, it shows the initial on `badgeColor(id)`.
    - When the `photo` prop is `undefined`, it reads the club's thumbnail through `useClubThumb(id)`. That is a
      module-level `Map` cache filled by one `getDoc(clubs/{id})` per id per tab, with listeners notified when it
      fills; a refused or missing read caches `""`.
    - `photo === ""` means "known: none", so no read happens.

- [ ] **Step 1: Write the failing check.** In `clubPhoto.check.mjs`, add `badgeStyle(id, photo)` from `clubPhoto.js`,
  the pure part of the badge, and assert:
  - with a photo: `{ background: <color>, backgroundImage: 'url("data:image/jpeg;base64,xx")' }`;
  - without one: `{ background: <color> }`.

  Then run it. Expected: fail.
- [ ] **Step 2: Implement** `badgeStyle`, `ClubBadge`, `useClubMedia`, `setClubPhoto`, `setClubCover`, and the
  `useSessionSync` key. Add CSS:
  - `.club-photo-badge` (`background-size:cover; background-position:center`): it lets any existing badge class show
    a photo;
  - `ClubBadge` adds it when there is a photo.
- [ ] **Step 3: Run** `node src/utils/clubPhoto.check.mjs && npm run build`. Expected: pass, and the build succeeds.
- [ ] **Step 4: Stage.**

### Task 4: The header, Share menu and Edit club

**Files:**
- Create:
  - `src/components/ClubHeader.jsx`: cover, photo, name, meta line, actions, tabs slot.
  - `src/components/ClubShareMenu.jsx`: replaces `ClubHeaderActions.jsx`, which is deleted.
  - `src/components/EditClubModal.jsx`.
- Modify:
  - `src/ClubApp.jsx` (~350-380): the header markup moves into `ClubHeader`, and Club tools props are removed.
  - `src/clubs.css`: new section "Club header (2026-11-12)".

**Interfaces:**
- Consumes: `ClubBadge`, `useClubMedia`, `setClubPhoto`, `setClubCover` (Task 3); `ClubProfileSettings`
  (`club`, `isOwner`, `onSave`) for the text fields; `Modal`; `ShareModal`; `useInvite`; `RowMenu`, or a `details`
  menu like the old one.
- Produces:
  - `<ClubHeader clubId club role canManage isMember isOwner memberCount route tabs={node} onShareBooking onEdit actions notify />`
  - `<EditClubModal clubId club isOwner onClose onSaveProfile notify />`

Layout and behavior:
- **Cover:** 150 px tall on desktop, 110 px on a phone, the image center-covered. With no cover: `badgeColor(clubId)`
  as a gradient to `--brand-deep`, plus the `Wave` component.
- **Club photo:** 88 px desktop / 70 px phone, overlapping the cover by 38 / 30 px, with a 4 px `--panel` ring.
  - It uses the `useClubMedia` photo; while that is loading or missing it falls back to `ClubBadge` with the club
    doc's `photo`.
- **Name:** the `h1` on the overview, a `p` elsewhere (keep the one-h1 rule from today's header).
- **Meta line:** role pill (lime for owner and manager, `--soft` for member), then icon + "Public club" / "Private
  club", the place, and "{n} members" (members only).
- **Member count:** `useMembers(isMember ? clubId : null).members.length`. Add a `ponytail:` note that it listens to
  the whole member list, and suggest a count query if clubs grow large.
- **Actions:**
  - **Share** (everyone in a public club; managers in a private club) opens a menu:
    - Share booking page: public clubs only. It opens the existing booking share modal (`setShowShare(true)` in
      `ClubApp`).
    - For managers: Share invite link / Reset invite link / Create invite link, with the logic of today's
      `ClubHeaderActions`. The `hint` uses `club.name`, passed in, which fixes the crash.
  - **Edit club** (managers): opens `EditClubModal`.
  - Camera buttons (managers) on the cover ("Change cover", top right, glass style) and on the photo (a lime circle
    in the corner). Both open `EditClubModal`.
- **EditClubModal:**
  - **Top:** the cover preview with **Change cover** and **Remove**. Under it, the photo with **Change photo** and
    **Remove**.
    - Each button uses a hidden `<input type="file" accept="image/*">`.
    - Picking a file saves at once (button shows "Saving…").
    - Success toasts: "Cover updated." / "Photo updated." / "Cover removed." / "Photo removed."
    - On failure, the error message shows inline.
  - **Below:** `<ClubProfileSettings club isOwner onSave={onSaveProfile} />`, unchanged. That gives the same fields,
    validation and the visibility batch.
  - **Note:** the mockup's single "Save changes" is replaced by photos that save on pick plus the profile form's own
    Save. It's simpler, and nothing is lost if the window closes.
- **Tabs:** pass `ClubTabs` in as `tabs`, unchanged. The "Announcements" label stays until step 2.

- [ ] **Step 1:** Build `ClubHeader`, `ClubShareMenu` and `EditClubModal`, wire them in `ClubApp`, delete
  `ClubHeaderActions.jsx`, and add the CSS. Run `npm run build`. Expected: success, no unused import warnings from
  the deleted component.
- [ ] **Step 2: Browser, desktop 1280, light.** As `ann`, on `/clubs/pub`, check:
  - the cover shows the color and wave, and the badge shows "P";
  - Share opens a menu with the booking page and invite items;
  - **Share invite link opens its modal with "joins Pub Club" in the hint (no crash)**;
  - Edit club opens. Upload a test JPEG, for example from `public/help/`, as the cover and as the photo: the header
    updates and the toasts show.
  - Check the size: `document.querySelector('.club-head-photo')` uses the 256 image.
- [ ] **Step 3: Browser, dark + 390 px.**
  - No sideways scroll (`scrollWidth - innerWidth === 0`).
  - The actions fill a row under the name.
  - The camera buttons are ≥ 40 px tap areas (measure with `elementFromPoint`).
- [ ] **Step 4: Browser, member view.** Sign out and in as `eli@demo.test`, a member of `pub` (if not, join with
  the invite link from step 2), and check:
  - Share shows only Share booking page;
  - there is no Edit club and no camera buttons;
  - the photo shows.
- [ ] **Step 5: Stage.**

### Task 5: Club photo everywhere a badge shows

**Files:**
- Modify:
  - `src/components/AccountSidebar.jsx:36`
  - `src/components/ChatPane.jsx:83`
  - `src/components/SessionCard.jsx:15` (passes `photo={s.clubPhoto}`)
  - `src/OpenPlay.jsx:390`
  - `src/views/FindClubs.jsx:52,73`: these have the club doc, so pass `photo={c.photo || ""}`.
  - `src/views/FindClubs.jsx:87` (card cover: `--club` stays; if `c.photo` is set, show it as the card's small badge,
    not as the cover)
  - `src/views/Hub.jsx:104,128,171`: 104 passes `s.clubPhoto`; the others read through the cache.
  - `src/views/Inbox.jsx:47`

**Interfaces:**
- Consumes: `<ClubBadge id name photo? className />` (Task 3). Keep each place's existing class name so the sizes
  don't change.

- [ ] **Step 1:** Replace each `<span className="X" style={{ background: badgeColor(..) }}>{clubInitial(..)}</span>` with
  `<ClubBadge className="X" id={..} name={..} photo={..} />`. Remove the `badgeColor` / `clubInitial` imports that
  are no longer used. Run `npm run build`. Expected: success.
- [ ] **Step 2: Browser.** With the photo set in Task 4, check that it shows in:
  - the sidebar's Your clubs (also collapsed);
  - Home (Coming up, the club list);
  - Clubs;
  - Find a game, after `useSessionSync` copies `clubPhoto` (open the club once as `ann`, then check);
  - Inbox, if a club chat exists;
  - `/open-play?club=pub`.

  Then remove the photo in Edit club. Expected: the initial is back in all of them after a reload.
- [ ] **Step 3: Checks and docs.**
  - Run `node src/utils/clubPhoto.check.mjs && node src/utils/sessions.check.mjs && node src/utils/receipt.check.mjs && npm run test:rules`.
    Expected: all pass.
  - Update `CLAUDE.md`:
    - a "Club header and photos (2026-11-12)" entry: data paths, sizes, `ClubBadge`, `ClubShareMenu`,
      `EditClubModal`, and "The rules must be re-published";
    - in the "Hub and club screens" entry, Club tools is replaced by Share / Edit club.
- [ ] **Step 4: Stage,** and tell the owner it's ready to check in the browser and commit.
