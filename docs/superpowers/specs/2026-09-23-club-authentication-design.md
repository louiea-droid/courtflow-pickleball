# Club Authentication & Session Lifecycle — Design Spec

Date: 2026-09-23
Status: Approved by user, pending implementation plan

## 1. Problem

Today "logging in" to CourtFlow is just typing a club name — it slugifies to a
Firestore document ID (`sessions/{slug}`) and that's it. Anyone who knows or
guesses the name has full read/write access to that club's live roster,
courts, and stats. There's also no real distinction between "the game is over
for today" and "sign out of this browser" — the existing sidebar action
(recently renamed from "End Session" to "Switch Club") only clears local
storage and never touches data.

This spec covers adding real password authentication (via Firebase Auth) and
a genuine "End Session" action that closes out a day's play: archiving stats,
clearing the match log and courts, and checking everyone out, while keeping
the roster intact for next time.

## 2. Goals

- A club name + password is required to write to that club's data. Reading
  stays open (see §5 — the public Live Board depends on this).
- New club name + password → creates the account and a fresh session, same
  as today's "new club" path.
- Existing, not-yet-password-protected club ("legacy" data from before this
  change) → the first successful login with any password *claims* it: an
  account is created with that password, existing data is left untouched.
- A real **End Session** action: archives aggregate stats to `history`
  (matches today's archive shape, no raw match log), clears the match log,
  empties every court, resets every player's games/wins/losses to 0, checks
  every player out, then signs out back to the login screen.
- **Switch Club** stays as a separate, non-destructive sign-out (no data
  change) for moving to a different club's login.
- **New Session** (existing in-app action: full roster wipe) is unchanged and
  stays available for "start completely over," distinct from End Session.

## 3. Non-goals (explicitly out of scope)

- Password reset / "forgot password" flow.
- Email verification, real email delivery, or any use of the synthetic email
  outside Firebase Auth's internals.
- Locking down *reads* — the public Live Board must keep working without
  login (§5).
- Any protection against a legacy club being claimed by someone other than
  its original user — see §8 (Known limitation).

## 4. Identity model

The club-name → Firestore-doc-ID slugification already in
`utils/club.js` (`slugifyClub`) is unchanged. For auth, that same slug
derives a synthetic email used only as Firebase Auth's identifier:

```
{slug}@courtflow.local
```

This is never a real, deliverable address — Firebase Auth doesn't require
that, it only needs a unique identifier plus a password. The actual password
is stored and verified entirely inside Firebase Auth; nothing password-shaped
is ever written to Firestore.

## 5. Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sessions/{sessionId} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.token.email == sessionId + '@courtflow.local';

      match /{subcollection=**} {
        allow read: if true;
        allow write: if request.auth != null
          && request.auth.token.email == sessionId + '@courtflow.local';
      }
    }
  }
}
```

Reads stay public for every path (needed for: the Live Board spectator view,
the login screen's club-name autocomplete directory, and the claim-flow's
"does this club already exist" check). Writes anywhere under a club's
document require being signed in as that exact club. Using
`{subcollection=**}` collapses the current five near-identical
`players`/`courts`/`history`/`costs`/`matchLog` blocks into one rule instead
of repeating the same read/write pair five times.

## 6. Login / signup flow

One form (club name + password), same shape as today — the branch between
"new," "claim," and "returning" is resolved automatically, not chosen by the
user:

1. `signInWithEmailAndPassword(auth, email, password)`
   - **Success** → go straight to the dashboard. No "Continue vs. Start
     Over" prompt — whatever state the club's data is in (from last time, or
     freshly reset by End Session) is just what loads. Stop here.
   - **Any failure** → don't try to interpret which Firebase error code it
     was (these vary across SDK versions/configs) — just continue to step 2
     and let *that* call's result disambiguate things.
2. `createUserWithEmailAndPassword(auth, email, password)`
   - **`auth/email-already-in-use`** → an account really did exist, so the
     step-1 failure was a wrong password → show "Incorrect password for
     `{club name}`." on the form.
   - **`auth/weak-password`** → no account existed, but Firebase's own
     minimum (6 characters) wasn't met → show that inline.
   - **Success** → an account genuinely didn't exist yet; check Firestore
     for `sessions/{slug}`:
     - **Doesn't exist** → genuinely new club: seed a fresh session + courts
       (same `createFreshSession` used today), go to dashboard.
     - **Exists** (legacy, pre-auth club) → claim flow: leave all existing
       data untouched, go to dashboard.

This reuses Firebase Auth's own account-existence bookkeeping (via which of
the two calls succeeds) to distinguish all three cases, instead of
inventing a separate "claimed" flag in Firestore, and it never depends on
matching a specific error code from step 1.

### Removed: the Continue/Start-Over prompt

`ClubSessionChoice.jsx` and the `pendingClub` / `confirmContinue` /
`confirmNewSession` / `cancelPendingClub` machinery in `useClub.js` are
deleted. They existed to ask "continue or start fresh?" whenever an existing
club name was typed — that question no longer makes sense once login always
just resumes current state, and "start fresh" is still available post-login
via the existing New Session button.

## 7. End Session (new)

Sidebar gets a new action, alongside the existing Switch Club:

**End Session** — confirm dialog: *"End today's session? Stats are archived
to Past Sessions, courts are cleared, and everyone will need to check in
again next time."* On confirm:

1. If `players` roster has any recorded games (`totalGames > 0`), write one
   `history` doc: `{ endedAt, matches: totalGames/2, players: [{id, name,
   games, wins, losses}] }` — same shape the app already writes today via
   `confirmContinue`/`newSession`. No raw match log is included, matching
   what already happens.
2. Delete every `matchLog` entry.
3. For every player: reset `games`, `wins`, `losses` to `0`, `partners: []`,
   `lastResult: null`, and set **`checked: false`** (this is the one field
   none of today's existing reset paths touch).
4. For every court: set `teamA: []`, `teamB: []` (court count, names, and
   levels are left as configured).
5. `signOut(auth)` (Firebase) **and** clear the local club cache — back to
   the login screen. Logging back in with the password resumes on the
   now-reset dashboard.

### Switch Club (existing, adjusted)

Currently only clears `localStorage`. It must now also call `signOut(auth)`
— otherwise Firebase's own persisted session would silently keep the browser
authenticated, and a later "New Session" / login attempt could act as that
club without ever re-entering the password. No data changes, same as today.

### Comparison

| Action | Roster | Stats | Match log | Courts | Checked-in | Signs out |
|---|---|---|---|---|---|---|
| **Switch Club** | untouched | untouched | untouched | untouched | untouched | yes |
| **End Session** | kept | archived, reset to 0 | cleared | emptied | all false | yes |
| **New Session** (unchanged) | wiped (players deleted) | archived, then gone with roster | cleared | recreated | n/a | no |

## 8. Known limitation (accepted, not fixed here)

"Claim-on-first-login" means whoever first types an existing legacy club's
exact name with any password becomes its owner from then on — there's no way
to verify they're the original user, because no ownership concept existed
before this change. This matches the trust model that already existed
(anyone who knew the name had full access); the new model narrows it to
"whoever claims it first," which is what the user explicitly chose over
leaving old clubs permanently inaccessible.

Also unchanged: the login screen's club directory (`ClubLogin.jsx`) still
publicly lists recent club names via an open read query — this is existing
behavior, not something this change introduces or worsens (reads were
already open), and is left as-is.

## 9. Manual prerequisite (cannot be done from code)

In the Firebase Console, **Authentication → Sign-in method**, the
**Email/Password** provider must be enabled for this project before any of
this works. This is a one-time console action outside the scope of what can
be scripted here.

Cost: confirmed free (email/password sign-in is free up to 50,000 monthly
active users on every Firebase plan, no card required).

## 10. Files touched

- `src/firebase.js` — add and export `auth` (`getAuth(app)`).
- `src/utils/club.js` — add an `authEmail(slug)` helper (`` `${slug}@courtflow.local` ``).
- `src/hooks/useClub.js` — rewritten: `onAuthStateChanged`-driven, the
  sign-in → create → claim/new resolution in §6, `endSession` (new, per §7),
  `switchClub` (renamed from today's `endSession`, now also calls
  `signOut`). `pendingClub`/`confirmContinue`/`confirmNewSession`/
  `cancelPendingClub` removed.
- `src/components/ClubLogin.jsx` — add password field, inline error message
  state, submit calls the new resolved login flow.
- `src/components/ClubSessionChoice.jsx` — deleted.
- `src/components/Sidebar.jsx` — new "End Session" button alongside "Switch
  Club".
- `src/App.jsx` — wire the new `endSession` action + its confirm dialog;
  remove `ClubSessionChoice` usage and `pendingClub` wiring.
- `firestore.rules` — replaced per §5.

## 11. Manual testing plan

Against a real (or throwaway) Firebase project with Email/Password enabled:

1. New club name + password → lands on dashboard; refresh the page → still
   signed in (Firebase persistence); Firestore shows a fresh session doc.
2. Same club name, wrong password → "Incorrect password" shown, no data
   touched.
3. Log out (Switch Club), log back in with correct password → resumes
   as-is, no prompt.
4. Existing pre-auth club (create one by hand in Firestore without an auth
   account) → first login with any password succeeds and preserves its
   existing players/courts; a second login later with that same password
   also succeeds; a different password on that club now fails.
5. End Session with some games played → `history` doc appears with correct
   aggregate numbers, match log empties, courts empty, every player shows
   `checked: false` and `games/wins/losses: 0`, then lands back on login.
   Logging back in resumes straight into that reset dashboard.
6. Live Board share link, opened in a logged-out/incognito context → still
   loads and shows live courts without needing to log in.
