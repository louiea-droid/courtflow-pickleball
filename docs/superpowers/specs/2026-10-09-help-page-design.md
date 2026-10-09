# Help page

**Goal.** One Help page for the whole system. The seven major features each get a visual guide (real screenshots, numbered steps); the queueing system is the featured one, written so a player understands everything about it. Everything else is short written entries.

## What the owner asked for

- A help page for the whole system: major features as a guide with visuals, minor features in words.
- **Screenshots** for the visuals (chosen over drawn mock-ups).
- Major features include the Quick session (no login) and Home. Accounts, Settings and Friends/Inbox are **minor**.
- Highlight the **queueing system** so players know and understand everything in it.

## Where it lives

- Route `/help` (route name `help`), in the signed-in frame (`AccountApp`), sidebar entry **Help** (`CircleHelp` icon) just above the Collapse row, and a **Help** item in the account menu. Title "Help".
- Content is data, not markup: `src/data/help.js` exports `MAJOR` (sections with `id`, `title`, `summary`, `steps[]`, `shots[]` `{ src, alt, caption }`, `go` `{ to, label }`), `QUEUE` (the featured section, below) and `MINOR` (`[{ id, title, body }]`). `src/views/Help.jsx` renders it. Adding a feature later is one entry.
- Layout: a contents list on the left that stays in view (a "Jump to" select on a phone), a search box that filters sections and minor entries on the device, the major features as sections with their screenshots in a frame (an image opens full size in a new tab), then "More" with the minor entries as a plain list.
- Screenshots: `public/help/*.png`, light theme, 1280 px wide crops from the local emulators with seeded demo data (names like "Ann", "Bea", "Pub Club"; no real people), each under 250 KB, lazy-loaded with explicit width/height so nothing jumps. Alt text describes what the screen shows. They show one theme and go stale when the UI changes; the data file lists the screens so a refresh is a known checklist (`docs/help-screenshots.md`).

## Major features (re-evaluated)

1. **Home**: the Ready-to-play bar, your active session, Coming up by date, Friends and Inbox tiles, My clubs. Shot: Home.
2. **Quick session (no login)**: `/club`, the classic queue app with nothing to sign up for; data stays in this browser; End Session archives stats. Shot: the dashboard with courts and a queue.
3. **Clubs**: the Clubs directory, creating a club, joining (ask to join, invite link), roles (owner, manager, member), the Members tab. Shots: Clubs page, a club's Members tab with the invite link.
4. **Open play**: a manager creates an event, shares the booking link or QR code, players send a request, the host approves; seats, waitlist, payment status. Shots: Host list, the public booking page.
5. **Find session**: the week strip, search, the cards, joining through the club's booking page. Shot: Find session.
6. **Running a game**: Proceed to game from an event, checking players in, courts, starting a match, recording the winner (and Undo), ending a game, cost split. Shots: the game dashboard, the Queue tab.
7. **The queue, for players** (featured, expanded, with its own heading and a coloured edge): everything a player needs. Shots: the Home active-session card, the read-only queue page, the Queue tab, the mode picker.

### The queue for players: content outline

- **How you get in:** the host checks you in when you arrive; only checked-in players are in the queue. A booking alone is not a place in line.
- **Who is picked next:** fewest games first, then the earliest check-in. So someone who just played goes to the back, and a late arrival with zero games moves ahead of players who have played more.
- **Seeing where you stand:** "Your active session" on Home shows playing now / you're up next / "#N in line, M players ahead, about X min". The estimate assumes ~15 minutes a game and says "about" because some modes pick by other rules. The read-only queue page ("View queue") shows the same for everyone in the game.
- **The modes** (what each does to who you play with and when): Balanced (fair turns, strongest with weakest, avoids repeat partners), Skill Separated (one level per match; if your level is short you keep your place), Custom (host builds every match), Winners / Losers (winners stay on until the win-streak cap, challengers are recent winners first), Mixed Doubles (one man and one woman per team; a player with no gender is skipped and shows a "!").
- **Winners stay on:** the optional rule and the cap (default 2 in a row), then they rest to the back.
- **Partner locks:** the host can lock two players as partners; a lock holds in every mode except where Mixed Doubles forbids it.
- **Skill levels and court levels:** a court can be limited to a level; levels are the six names (Beginner to Expert) with star ratings.
- **Game length alert, avoid repeat partners:** the club's queue rules.
- **Live Board:** the TV screen: courts, who is next, and what it shows or hides (skill stars, queue position, games and wins).
- **If something looks wrong:** a short "Why am I not next?" list (a player with fewer games is ahead; you are not checked in; the court is limited to another level; Skill Separated is waiting for enough players at your level; Mixed Doubles is waiting for a man or a woman).

## Minor features (words only)

Accounts and profile; friend code and friends; Inbox (club chat, direct messages, hide a conversation, unread count); Settings (club, session defaults, queue rules, cost, Live Board, display, theme); the sidebar (collapse, the logo, the sticky header and account menu); undo a match result (10 seconds); keyboard (Esc closes a dialog, Enter sends, Shift+Enter adds a line); time zone and 12/24-hour clock; export to CSV and past sessions; skill levels; deleting a club or an account; sign out.

## Out of scope

Video, an interactive tour, translations, a help chatbot, in-page screenshot capture for other themes, help for the Live Board's public URL options beyond one paragraph.

## Review focus

1. Every claim about the queue matches the code (`queueOrder`, `queueStatus`, `rotationModes`, `DEFAULT_RULES`): order, estimate, caps, mode behaviour. A wrong sentence in the featured section is the worst failure.
2. Screenshots contain no real names, emails, or club data; each has meaningful alt text; large images don't push the layout (width and height set, lazy loading).
3. The page works with no screenshots present (a missing file shows the caption, not a broken icon), on a phone (contents becomes a select, no horizontal scroll), and with the sidebar collapsed.
4. Search finds major and minor entries and says so when nothing matches; the contents list highlights the section in view; links ("Go there") land on the right screens.
5. Help is reachable from the sidebar and the account menu on every signed-in screen, and does not appear on the queue app, Live Board or public booking page.
