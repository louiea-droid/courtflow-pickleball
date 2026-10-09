# Help page screenshots: how to refresh them

The Help page (`/help`, `src/views/Help.jsx`, content in `src/data/help.js`) shows real screenshots from `public/help/`. They are **light theme, 1280 px wide, demo data only** (no real names, emails or clubs). They show the UI as it was when taken, so refresh the ones whose screen changed.

## Re-create the demo world

1. `npm run emulators` and `npm run dev:emu` (Vite on port 5300), nothing else on ports 8080 and 9099.
2. `node scripts/seed-help.mjs` seeds five demo accounts (`ann`, `bea`, `cal`, `dee`, `eli` at `@demo.test`, password `password1`), three public clubs (Pub Club owned by Ann, Beta Club, Riverside Pickle), sessions across the next days, a live game at Pub Club (`thursday`) where Eli is **#3 in line, 2 ahead, about 10 min**, and a Quick session for Ann.
3. Open the app in a browser at 1280 px wide (the Vite URL; on this machine `http://[::1]:5300` gave a clean storage origin), light theme, sidebar expanded.

## The shots

| File | Signed in as | Screen | Crop |
| --- | --- | --- | --- |
| `home.png` | Eli | `/` after the active session card has loaded | viewport |
| `active-queue.png` | Eli | the "Your active session" card on Home | the card only |
| `queue-page.png` | Eli | `/clubs/pub/event/thursday/queue` | viewport |
| `find-session.png` | Eli | `/sessions` | viewport |
| `clubs-directory.png` | Eli | `/clubs/find` | viewport |
| `club-members.png` | Ann | `/clubs/pub/members` | viewport |
| `host-events.png` | Ann | `/clubs/pub/host` | viewport |
| `booking-page.png` | anyone | `/open-play?club=pub` | the `.openplay` element (wait until the events show) |
| `game-dashboard.png` | Ann | `/clubs/pub/event/thursday/game`, Dashboard tab | viewport |
| `game-queue.png` | Ann | the same game, Queue tab | viewport |
| `modes.png` | Ann | the same game, Dashboard with the Mode picker open | viewport |
| `quick-session.png` | Ann | `/club` (reuses the signed-in account) | viewport (wait for "Live Court Rotation") |

Tips: pages load lazily, so wait until the content (not the spinner) shows before capturing; check each image after saving. Keep each file under 250 KB.

## After changing a screenshot

Update `w` / `h` for that image in `src/data/help.js` (the page reserves the space so nothing jumps) and run `node src/utils/help.check.mjs`.
