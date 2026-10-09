# Account and club screens: one consistent layout

Date: 2026-10-08. Status: approach B approved by the owner ("go b"); this spec awaits owner review.

## Goal

The hub, create club, club pages (overview, open play, event page, settings) and profile look and behave like one product, in light and dark, on desktop and phone. Out of scope by the owner's choice: the queue app (dark sidebar, `/club` and game screens), the public booking page `/open-play`, and the Live Board.

## What is inconsistent today

- The club name is the first tab in the top bar (really "Overview"), and Open play / Settings appear twice: in the bar and as buttons on the club page.
- An `<a class="outline">` has no text colour of its own, so the browser link colour shows (purple "Settings") next to a solid green primary button. Buttons inside the account shell also differ by screen.
- The top bar spans the full width while content sits in a centred 920px column, so edges do not line up. Hub cards fill only part of the row.
- Page titles: `Host open play` has a title and subtitle, the event page has its own header, club settings and profile have no title at all, the hub and club page use their own sizes.
- Empty states are large panels with a floating sentence and no next action.
- In dark mode the card borders are almost invisible, and every hub card has the same weight, including "Create a club".

## Design

Keep: Space Grotesk (titles) and DM Sans (text), the court-green accent, the club's own theme colours inside a club, all existing tokens. Colours are tokens only, never raw hex.

### 1. One top bar (global)

`[logo CourtFlow]  My clubs  ........  [account chip]`. Same on every screen in this area. The club tabs leave the bar. The bar's inner content uses the same max-width and side padding as the page below, so logo, content and account chip share left and right edges. The account chip (already in progress as `AccountMenu`) holds Profile and Sign out. On phones (under 560px) the chip shows only its icon.

### 2. Page frame

One container for all screens in this area: max width 1000px, centred, with the same side padding as the bar. Form screens (create club, profile, club settings) are capped at 720px inside it, left aligned. Page title: one style, 28px Space Grotesk 700, with an optional one-line subtitle in muted text, and page actions aligned to the right of the title row on desktop and wrapped below it on phones. Section headings (`h2`): 16px Space Grotesk 700. Spacing steps: 8, 14, 22, 32.

### 3. Club header and navigation (every `/clubs/:id/...` screen)

```
┌ arat                                   [Owner] [Public club]  ┐   compact header: name + pills
│ cebu · ww                                                     │   location + description (overview only)
└───────────────────────────────────────────────────────────────┘
  Overview   Open play   Members   Announcements                    tab strip, accent underline on the active tab
```

- The global sidebar keeps "My clubs" as the club switcher; the selected club links back to its overview. Club destinations sit in this horizontal header row instead of expanding beneath the club in the sidebar.
- Members see an Announcements feed alongside Overview and Members; managers can publish updates, and the latest three also appear on Overview. "Open play" stays active on event and game pages.
- Club tools stays available on every club page for managers: Start new, Play now, Share booking page, Settings, Manage members and the member invite link.
- On narrow screens the row scrolls horizontally rather than wrapping or crowding the club header.
- The duplicate buttons on the overview are removed. The overview shows the next open play and a single primary action for managers ("New open play").
- Settings page gets the title "Settings", profile gets "Profile".

### 4. Hub

Title "Hi, {name}". "Your clubs": a grid of club cards, each with the club name and a role pill (no extra reads). "Create a club" is a smaller dashed card after the clubs; when there are none it becomes the page's main call to action ("Create your first club"). Profile moves out of the hub (it is in the account menu). "Quick session" becomes one slim row under the clubs. Card grid uses the full container width (equal columns, no ghost column).

### 5. Buttons, cards, empty states

- `primary`: solid accent. `outline`: neutral (`--ink` text, `--line` border), also for anchors. `danger`: red, only in Danger zone and delete dialogs. One primary action per screen region; icons 15px.
- Cards and panels in this area use a border colour that stays visible in dark mode (`light-dark(var(--line), var(--line-strong))`, scoped to this area only so the queue app is unchanged).
- Empty state: one line of plain text plus the action that fixes it, inline ("No open play scheduled. [New open play]"), no tall empty panel.

### 6. Phone and accessibility

Works from 360px with no horizontal page scroll; the tab strip scrolls sideways if it ever overflows. Touch targets at least 44px. Visible focus on every control (existing focus ring). Tabs are a `nav` with `aria-label="Club"` and `aria-current="page"` on the active one. Body text contrast stays at 4.5:1 or better in both themes. Motion: keep existing hover transitions only; nothing new that moves on page load.

## Implementation notes

- All new CSS goes in `src/clubs.css` (loaded after `styles.css`, so equal-specificity rules win); `styles.css` is not edited, so the queue app, public page and Live Board cannot change. Scope rules under `.acct-shell`.
- Files touched: `AccountApp.jsx` (bar), `ClubApp.jsx` (header + tabs, remove bar tabs), `views/Hub.jsx`, `ClubHome.jsx`, `Host.jsx`, `EventPage.jsx` (title row only), `CreateClub.jsx`, `Profile.jsx`, `ClubSettings.jsx`, `components/AccountLogin.jsx` (width and card style only), `clubs.css`.
- Depends on the owner's uncommitted `AccountMenu` work (account chip). Implementation starts after those edits are committed, or builds on them as they stand once the owner says so.
- Not included (needs extra reads per club, add later if wanted): "next open play" on each hub card.

## Testing

No logic changes, so no new unit checks; existing checks (`node src/utils/*.check.mjs`, `npm run test:rules`) must still pass and `npx vite build` must succeed. Browser pass on the emulators with screenshots at 1440, 768 and 390 px, light and dark, for: sign-in, hub (no clubs, with clubs), create club, club overview as owner and as non-member, open play list, event page, club settings, profile. Check for horizontal scroll, keyboard focus, and the purple-link-colour bug on every anchor button.
