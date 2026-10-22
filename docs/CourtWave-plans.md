# CourtWave: all our plans in one place

*Last updated: October 22, 2026. Collected from the project notes, the earning plan and our conversations. Items marked **(you)** need you; the rest I can build.*

---

## 1. Things waiting on you right now

1. **Sign the Firebase tool in with the account that owns CourtWave (you).** Today's redesign is committed but not live because the tool is signed in as an account that can't see the project. In the chat: `! npx firebase login:add`, then tell me and I'll deploy.
2. **Publish the security rules in the Firebase console (you).** Several features built earlier changed `firestore.rules` (club joining, managers, active queue, friends, inbox, umpire scoring, open play live). Until the newest rules are published, those features may be refused on the live site.
3. **Deploy the search index for Find session** (`firebase deploy --only firestore:indexes`). I can run it once you're signed in.
4. **Merge the `courtwave` branch into `main`** when you're happy with it. Say the word and I'll do it.

---

## 2. The CourtWave redesign

**Done (committed, waiting to deploy):**
- Brand colors everywhere: deep court green, lime, paper white; green-tinted dark mode.
- New logo (script CW over a wave), with light and square versions.
- Public landing page at courtwave.web.app ("Catch your wave."), with scroll effects and a "Get the app" section.
- Home, Find session ("Find a game"), the club header and event page, Clubs (directory + My clubs tabs), Friends, Inbox, and the public booking page.

**Still to do (you asked to wait):**
- **Queue app (Dashboard).** Mockup already shown: one slim stats strip led by "Up next", court cards drawn like real courts, one small toolbar. You said "not yet".
- **Live Board** (the venue TV screen).
- **Refresh the Help page screenshots** so they show the new design.

---

## 3. Earning money with CourtWave

Full checklist: `docs/business/2026-10-16-earning-plan.md`.

**The idea:** players are always free; hosts and clubs pay for the tools that save them time.

| Phase | What | Notes |
|---|---|---|
| 0. Groundwork | Privacy policy and terms pages, a feedback link, a support email, start business registration (DTI or SEC, then BIR) **(you)** | Landing page already says "free while in early access" |
| 1. Early access | 5 to 10 real clubs for 4 to 8 weeks; interview each host | Learn what they'd pay for |
| 2. Club plan (Pro) | Monthly plan per club, about ₱299 to ₱499 (a guess to test). Pay by GCash at first; you switch clubs to Pro by hand | Pro features locked in the security rules, not just hidden |
| 3. Online payments | GCash and cards through a provider (PayMongo, Xendit), small booking fee (about ₱5 to ₱10, a guess) | Needs a registered business and Firebase's pay-as-you-go plan |
| 4. Extras | Live Board sponsors, featured clubs in Find session, tournaments | Once there are users |
| 5. White-label (future) | A venue chain or league gets its own branded copy: setup fee plus a yearly license | Branding moves into settings first; check and register the "CourtWave" trademark (IPOPHL) **(you)** |

Selling the whole business is only a long-term option, once there's revenue to show.

**Open decisions (you):** the Free / Pro split and price (after interviews); sole proprietor or corporation; whether online payments go straight to each host or through CourtWave; who pays the booking fee; a thank-you for the first clubs; when to start white-label and its fees.

---

## 4. The downloadable app (Android only for now)

The main reason: **volunteer umpires keeping score over a phone hotspot with no internet.** A website can't do that (browser security blocks it), but a real installed app can.

| Phase | What | Effort |
|---|---|---|
| 1. Installable web app (PWA) | App icon, works with weak signal, "Install app" button, asks before updating | About 1 day |
| 2. Android app (Capacitor) | Same app packaged for Android: opens without internet, native Google sign-in, share links fixed, screen stays awake, signing key **(you: install Android Studio, register the app in Firebase)** | About 2 to 4 days |
| 3. Offline hotspot scoring | The host's phone runs a small relay; volunteers scan a QR and score over the hotspot with no internet; everything uploads when internet returns. Gets its own design first | About 1 to 2 weeks |
| 4. Google Play (optional) | $25 one-time account, store listing, privacy policy; new accounts must run a closed test first. Until then, share the APK file directly | Later |

**Open decisions (you):** the app's permanent package name (suggested `app.courtwave`); the icon (the new CW logo is ready); APK first, Play Store later; order 1 → 2 → 3.

When the app exists, the landing page's "Download for Android" button switches on.

---

## 5. Features saved for later

- **Auto-fill button for Up Next (planned October 22, approved in outline, not built).**
  - *The problem:* removing a player from an Up Next (✕) leaves the seat empty on purpose (Up Next is locked since commit `f384364`). Sending 4 players to an open court doesn't refill it either: `startNextMatch` skips players held in other Up Nexts, and the blanks only fill when that court's match ends (`seatDraft` in `recordWin`). So Up Next shows "Add a player to send" with empty seats.
  - *The plan:* an **Auto-fill** button on the right of the "Up Next" heading, styled like the Live Courts one (outline, ⚡ icon). One press fills every empty Up Next seat from the waiting players in queue order; the players already there stay put; two courts never take the same person. A toast says what happened ("Filled 3 Up Next seats" / "Nobody free in the queue to fill the empty seats"). Greyed out when no Up Next has an empty seat; hidden in Custom mode (no Up Next there).
  - *How:* a click handler in `views/Dashboard.jsx` that goes court by court, tops up each draft and removes the used players from the pool, then saves the drafts (`setDrafts`). `QueueApp.jsx` passes the existing `seatDraft` as one prop, so court level, locked pairs and Mixed Doubles work the same as at rotation. No database writes (Up Next drafts live on the device).
  - *Unchanged:* ✕ still leaves the seat empty until Auto-fill, **+ Add player** or rotation; the Live Courts Auto-fill is as before.
  - *Left out:* a per-court Auto-fill (one button fills all); the automatic refill idea was dropped in favor of the button.
  - *Test:* emulators + `sq5` demo data: remove players from Up Next, send a group to an open court, press Auto-fill, check no player repeats; at desktop and 390px. Note: `npm run emulators` fails on the main PC because the `firebase` command isn't installed (`npm i -g firebase-tools` or `npx firebase-tools`).
  - *Also seen:* "grrr" showed on Court 2 and in Court 2's Up Next at the same time; probably two players with the same name. Check when testing.
- **Booking reminders** in the notification bell ("starting soon", "you moved up from the waitlist"). Needs a copy of each booking on the person's account.
- **"Join the club" card on the booking page:** for players who scanned the QR code, a small card under the booking form inviting them to join the club on CourtWave (approved design, not built).
- **Player self check-in by QR on the Live Board.** Two options discussed, none picked: (A) simple, anyone with the link can check in; (B) recommended, a 4-digit code that changes each session so people must be at the venue (needs a Cloud Function). Changes the security rules, so it's its own project.
- **Export roster and match history to Excel/CSV** (a safety net before deleting an account).
- **Import a roster from CSV.**
- **Past sessions list:** view or delete archived stats from End Session.
- **Currency setting** (₱ is fixed today).
- **Tighten who can read club data** (some club data can be read by anyone who knows the club's id).
- **Max games in a row per player.** Probably not needed, because the queue already favors whoever has played least.

---

## 6. Longer-term direction

- **More sports.** CourtWave is pickleball today ("Made for pickleball. More sports are on the way."). The logo and branding are kept sport-neutral; the scoring and rotation are pickleball-specific for now.
- **Custom domain** (e.g. courtwave.com) instead of courtwave.web.app (optional, costs a yearly fee).

---

## 7. Deliberately not doing

- Email or two-factor sign-in settings.
- Notification settings (until there are push notifications).
- Several staff logins per club through the old club login (clubs now have managers instead).
- Ads inside the app.
