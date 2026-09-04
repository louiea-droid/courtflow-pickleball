# CourtFlow — React + Firebase Pickleball Queue

## Stack
- React
- Vite
- Plain CSS
- Firebase Firestore
- Lucide React

## Setup

1. Install Node.js.
2. Extract the project.
3. Open a terminal in the project folder:
   npm install
4. Create a Firebase project at Firebase Console.
5. Create a Web App in Firebase and copy its config values.
6. Copy `.env.example` to `.env`.
7. Fill the `VITE_FIREBASE_*` values in `.env`.
8. In Firebase, create a Firestore Database.
9. For a quick prototype, use the included `firestore.rules`.
10. Start:
    npm run dev

## Data structure

sessions/{sessionId}
sessions/{sessionId}/players/{playerId}
sessions/{sessionId}/courts/{courtId}

The app uses Firestore `onSnapshot()` listeners, so queue/court/player changes are reflected in connected browsers in realtime.

## Project structure

```
src/
  main.jsx                 Entry point — mounts <App/>
  App.jsx                  Top-level state, Firestore actions, layout
  firebase.js              Firebase app + Firestore init
  styles.css                Global styles (design tokens, animations, responsive rules)
  data/constants.js        Session id, demo seed data, nav/title config
  utils/format.js          Small display helpers (stars, initials, win %, elapsed time)
  hooks/useSessionData.js  Firestore subscriptions + demo seeding
  components/              Reusable UI: Sidebar, Topbar, modals, Toast, PanelHead
  views/                   One file per tab: Dashboard, Queue, Players, Stats
```

The sidebar is fixed on desktop/tablet and becomes a slide-in drawer (toggled by a hamburger button in the topbar) on mobile widths (≤760px).

## Production security

The included rules intentionally allow reads/writes so the prototype can be tested immediately. Do NOT use those rules for a public production deployment. Add Firebase Authentication and restrict writes to an organizer/admin role before deployment.

## Recommended production upgrade

- Firebase Authentication for organizer/admin
- Anonymous/public live-board viewer
- QR code player check-in
- Transaction-based queue rotation
- Multiple sessions/venues instead of one `open-play` session
- Cloud Functions for secure match rotation
