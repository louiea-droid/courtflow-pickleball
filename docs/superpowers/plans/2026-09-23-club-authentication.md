# Club Authentication & Session Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CourtFlow's name-only "login" with real Firebase Auth (email/password keyed to the club-name slug), and add a genuine "End Session" action that archives stats and resets a club's roster for the next day of play.

**Architecture:** A club's Firestore doc ID (`sessions/{slug}`, from the existing `slugifyClub`) doubles as a Firebase Auth identity via a synthetic email `{slug}@courtflow.local`. The single login form resolves to sign-in / create-new / claim-legacy automatically by trying `signInWithEmailAndPassword` then `createUserWithEmailAndPassword` and reading whichever call's own error/success disambiguates the case — no separate "claimed" flag is stored. Firestore rules gate writes on `request.auth.token.email` matching that pattern; reads stay open everywhere (the public Live Board and the login screen's club directory both depend on open reads).

**Tech Stack:** React 19 + Vite, Firebase (`firebase/auth`, `firebase/firestore`) client SDK only — no backend. This codebase has no unit test framework (no Jest/Vitest, `package.json` has no `test` script). Verification in this plan is therefore: `npx vite build` for compile-time correctness, scripted browser interaction via the Playwright MCP tools for behavior (the method already used earlier in this project to verify UI changes), and one throwaway Node script (deleted after use) for the Firestore-rules task, since rejection of an unauthenticated write can't be observed through the app's own UI.

**Spec:** `docs/superpowers/specs/2026-09-23-club-authentication-design.md`

## Global Constraints

- Synthetic Auth email format is exactly `` `${slug}@courtflow.local` `` — must match between the login flow and the Firestore rule string.
- Firestore rule write condition: `request.auth.token.email == sessionId + '@courtflow.local'`.
- Firebase's own password minimum (6 characters) is the only password validation — no custom strength rules.
- No password reset, no email verification, no use of the synthetic email for anything but Firebase Auth's internal identifier — explicitly out of scope.
- Every Firestore path keeps public `read` — required for the Live Board spectator view and the login screen's autocomplete directory.
- `ClubSessionChoice.jsx` and the `pendingClub` / `confirmContinue` / `confirmNewSession` / `cancelPendingClub` machinery in `useClub.js` are removed entirely, not deprecated.
- **Switch Club**: sign-out only, zero data changes.
- **End Session**: archive stats to `history` only if `totalGames > 0`, clear `matchLog`, empty every court's `teamA`/`teamB`, reset every player's `games`/`wins`/`losses` to `0` and `partners`/`lastResult` to empty/null, set every player's `checked` to `false`, then sign out. Roster (player docs themselves) is never deleted.
- **New Session** (existing in-app full-roster-wipe action) is unchanged by this plan.

## Review Focus

- Wrong password on an already-claimed club must show an error and must not create a duplicate Auth account or touch any Firestore data — tested in Task 1.
- A new/claim password under Firebase's 6-character minimum must show a clear inline message, not a silent failure — tested in Task 1.
- Ending a session with zero games recorded must not write a junk empty `history` entry — tested in Task 2.
- The public Live Board link must still load with no login after rules are hardened — tested in Task 3.
- A raw unauthenticated write attempt (bypassing the app's own UI) must be rejected by the deployed rules themselves, not merely prevented by client-side code — tested in Task 3.

---

## Task 1: Real login — Firebase Auth wiring, sign-in/create/claim resolution, password UI

**Files:**
- Modify: `src/firebase.js`
- Modify: `src/utils/club.js`
- Modify: `src/hooks/useClub.js` (full rewrite)
- Modify: `src/components/ClubLogin.jsx`
- Modify: `src/App.jsx:1-45,506-521` (imports, `useClub()` destructuring, login-screen render)
- Delete: `src/components/ClubSessionChoice.jsx`

**Interfaces:**
- Produces: `useClub()` now returns `{ club, loggingIn, loginError, login(rawName, password), switchClub(), endSession() }`. `club` is `{ id, name } | null`. `login` and `switchClub` are used in this task; `endSession` is implemented as a stub here (`async function endSession() {}`) and filled in by Task 2 — the export must exist now so Task 1's `App.jsx` wiring compiles, even though nothing calls it yet.
- Consumes: nothing from other tasks (this is the first task).

- [ ] **Step 1: Add `auth` export to `src/firebase.js`**

Replace the whole file with:

```js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
```

(This also cleans up the previous `initializeApp(firebaseConfig) && getFirestore()` one-liner, which relied on `&&` short-circuiting — needed now that the same `app` instance is passed to both `getFirestore` and `getAuth`.)

- [ ] **Step 2: Add `authEmail` helper to `src/utils/club.js`**

Add this function (keep everything else in the file unchanged):

```js
export function authEmail(slug) {
  return `${slug}@courtflow.local`;
}
```

- [ ] **Step 3: Rewrite `src/hooks/useClub.js`**

Replace the whole file with:

```js
import { useEffect, useState } from "react";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { seedSession } from "../data/constants";
import { authEmail, loadStoredClub, saveStoredClub, slugifyClub } from "../utils/club";

async function createFreshSession(batch, id, clubName) {
  batch.set(doc(db, "sessions", id), { ...seedSession, location: clubName, createdAt: Date.now() });
  for (let i = 1; i <= seedSession.courts; i++) {
    batch.set(doc(db, "sessions", id, "courts", `court-${i}`), {
      courtNumber: i, start: Date.now(), teamA: [], teamB: [],
    });
  }
}

export function useClub() {
  // Seeded from the last-known local cache so the app can paint the
  // dashboard immediately on a repeat visit instead of flashing the login
  // screen — onAuthStateChanged (below) corrects this if the cache is
  // stale or the session is no longer valid.
  const [club, setClub] = useState(loadStoredClub);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setClub(null);
        saveStoredClub(null);
        return;
      }
      const id = user.email.slice(0, user.email.indexOf("@"));
      const snap = await getDoc(doc(db, "sessions", id));
      const next = { id, name: snap.exists() ? (snap.data().location || id) : id };
      setClub(next);
      saveStoredClub(next);
    });
    return unsubscribe;
  }, []);

  // One form, three outcomes, resolved automatically: sign in (returning
  // club), create + seed (brand-new club name), or create + leave data
  // alone (claiming a pre-auth club with data but no password yet). The
  // create call's own error/success is what disambiguates "wrong
  // password" from "no account yet" — see spec §6 for why sign-in's error
  // code is deliberately not branched on.
  async function login(rawName, password) {
    const clubName = rawName.trim();
    if (!clubName || !password) return;
    const id = slugifyClub(clubName);
    const email = authEmail(id);
    setLoggingIn(true);
    setLoginError("");
    try {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        return;
      } catch {
        // No account yet, or wrong password — the create attempt below tells us which.
      }
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          setLoginError(`Incorrect password for ${clubName}.`);
        } else if (err.code === "auth/weak-password") {
          setLoginError("Password must be at least 6 characters.");
        } else {
          setLoginError("Couldn't log in — please try again.");
        }
        return;
      }
      const existing = await getDoc(doc(db, "sessions", id));
      if (!existing.exists()) {
        const batch = writeBatch(db);
        await createFreshSession(batch, id, clubName);
        await batch.commit();
      }
      // Existing doc with no prior Auth account (legacy/claim case): left untouched.
    } finally {
      setLoggingIn(false);
    }
  }

  // Local sign-out only — no data changes. For "the game's over," use endSession.
  async function switchClub() {
    await signOut(auth);
  }

  // Filled in by the next task (archive + reset today's session).
  async function endSession() {}

  return { club, loggingIn, loginError, login, switchClub, endSession };
}
```

Note: `writeBatch` is used by `createFreshSession`'s `batch.set` calls; `doc`/`getDoc` are used by `login`'s and the `onAuthStateChanged` handler's Firestore lookups. Task 2 extends this same file's import line to add `collection` and `getDocs`, which nothing in Task 1 needs.

- [ ] **Step 4: Add the password field and error display to `src/components/ClubLogin.jsx`**

Replace the whole file with:

```jsx
import { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { LogIn, Search } from "lucide-react";
import { db } from "../firebase";

export default function ClubLogin({ onLogin, loading, error }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [directory, setDirectory] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const passwordRef = useRef(null);

  // One-time fetch of every club that has ever started a session, so typing
  // can surface a match instead of requiring the exact remembered name.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(200)));
        if (!cancelled) setDirectory(snap.docs.map((d) => ({ id: d.id, name: d.data().location || d.id })));
      } catch {
        // Directory is a nice-to-have; typing the exact name still works without it.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const typed = name.trim().toLowerCase();
  const matches = typed
    ? directory.filter((c) => c.name.toLowerCase().includes(typed)).slice(0, 8)
    : [];

  const submit = (e) => {
    e.preventDefault();
    if (name.trim() && password && !loading) { setOpen(false); onLogin(name.trim(), password); }
  };

  const pick = (clubName) => {
    setName(clubName);
    setOpen(false);
    passwordRef.current?.focus();
  };

  return (
    <div className="clublogin">
      <form className="clublogin-card" onSubmit={submit}>
        <img className="mark" src="/images/courtflow.png" alt="" />
        <h1>CourtFlow</h1>
        <p>Enter your club or venue name and password to start or continue a session.</p>
        <label className="clublogin-search" ref={wrapRef}>
          Club name
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="e.g. Centro Pickle Club"
            autoComplete="off"
            autoFocus
          />
          {open && matches.length > 0 && (
            <div className="clublogin-suggestions">
              {matches.map((c) => (
                <button type="button" key={c.id} className="clublogin-suggestion" onClick={() => pick(c.name)}>
                  <Search size={13} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </label>
        <label className="clublogin-password">
          Password
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="clublogin-error">{error}</p>}
        <button className="primary" disabled={loading || !name.trim() || !password}>
          <LogIn size={16} /> {loading ? "Loading…" : "Continue"}
        </button>
        <p className="clublogin-hint">
          New club name + password → creates a new club. Existing club name → enter its
          password to continue right where you left off.
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Add the error-message style to `src/styles.css`**

Find `.clublogin-hint` in `src/styles.css` and add this rule right after its block (match the existing `.clublogin-*` block's style — check the file for the exact existing declarations to match color variables used nearby, e.g. `var(--muted)`):

```css
.clublogin-error{color:#c94b4b;font-size:12.5px;font-weight:700;margin:-4px 0 0}
```

- [ ] **Step 6: Delete `src/components/ClubSessionChoice.jsx`**

```bash
git rm "src/components/ClubSessionChoice.jsx"
```

- [ ] **Step 7: Update `src/App.jsx` to use the new `useClub()` shape**

In `src/App.jsx`:

1. Remove the line `import ClubSessionChoice from "./components/ClubSessionChoice";`.
2. Replace:

```js
  const {
    club, loginClub, endSession: signOutClub, loggingIn,
    pendingClub, confirmContinue, confirmNewSession, cancelPendingClub,
  } = useClub();
```

with:

```js
  const { club, loggingIn, loginError, login, switchClub, endSession } = useClub();
```

3. Replace the login-screen render block:

```jsx
  if (!club) {
    return (
      <>
        <ClubLogin onLogin={loginClub} loading={loggingIn} />
        {pendingClub && (
          <ClubSessionChoice
            clubName={pendingClub.name}
            loading={loggingIn}
            onContinue={confirmContinue}
            onNew={confirmNewSession}
            onCancel={cancelPendingClub}
          />
        )}
      </>
    );
  }
```

with:

```jsx
  if (!club) {
    return <ClubLogin onLogin={login} loading={loggingIn} error={loginError} />;
  }
```

(`switchClub` and `endSession` are wired into the sidebar in Task 2 — leaving them unused in this task's App.jsx is fine, Task 2 consumes them immediately after.)

- [ ] **Step 8: Verify the build compiles**

Run: `npx vite build`
Expected: `✓ built` with no errors. (There will be no "unused variable" failures — Vite/esbuild doesn't fail builds on that — but if `switchClub`/`endSession` show as unused in your editor, that's expected until Task 2.)

- [ ] **Step 9: Manual verification — brand-new club**

In the Firebase Console for the target project, confirm **Authentication → Sign-in method → Email/Password** is enabled (this plan cannot enable it programmatically — stop and do this by hand if it isn't on yet).

Start the dev server and drive it with the Playwright MCP tools (`browser_navigate`, `browser_type`, `browser_click`, `browser_snapshot`) the same way this project's earlier UI fixes were verified:

1. `npx vite --port 5183` (background).
2. Navigate to `http://localhost:5183/`.
3. Type a brand-new club name (e.g. `Plan Test Club 1`) and a password of at least 6 characters, submit.
4. Expected: lands on the dashboard. In the Firebase Console → Authentication → Users, a user with email `plan-test-club-1@courtflow.local` now exists. In Firestore, `sessions/plan-test-club-1` exists with `location: "Plan Test Club 1"`.
5. Refresh the page. Expected: still on the dashboard (no re-login prompt) — this confirms `onAuthStateChanged` correctly restores the session.

- [ ] **Step 10: Manual verification — wrong password**

1. Use the sidebar's "Switch Club" button if already present from a previous session's build, or otherwise call `signOut` by clearing the browser's site data, to get back to the login screen. (If Task 2's sidebar button doesn't exist yet, temporarily clear IndexedDB/local storage for `localhost:5183` via the browser devtools to force a sign-out for this check.)
2. Type `Plan Test Club 1` again with a deliberately wrong password, submit.
3. Expected: an inline message reading "Incorrect password for Plan Test Club 1." appears; still on the login screen; no new Firebase Auth user was created (check the Console — user count for that email is still exactly one).

- [ ] **Step 11: Manual verification — weak password on a new name**

1. Type a different brand-new club name with a 3-character password, submit.
2. Expected: inline message "Password must be at least 6 characters."; no Firestore doc or Auth user was created for that name.

- [ ] **Step 12: Commit**

```bash
git add src/firebase.js src/utils/club.js src/hooks/useClub.js src/components/ClubLogin.jsx src/App.jsx src/styles.css
git add "src/components/ClubSessionChoice.jsx"
git commit -m "Add Firebase Auth login (sign-in/create/claim), remove Continue-vs-Start-Over prompt"
```

---

## Task 2: End Session — archive, reset, and sign out

**Files:**
- Modify: `src/hooks/useClub.js` (replace the `endSession` stub from Task 1)
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/App.jsx` (new confirm dialog + state, split the old single dialog into two)

**Interfaces:**
- Consumes: `useClub()`'s `{ club, switchClub, endSession }` from Task 1 (same shapes, `endSession` now has a real body).
- Produces: `Sidebar` now takes two separate props `onEndSession` and `onSwitchClub` (previously a single `onEndSession` covered what's now `onSwitchClub`'s behavior).

- [ ] **Step 1: Implement `endSession` in `src/hooks/useClub.js`**

Add `collection, doc, getDocs, writeBatch` to the existing `firebase/firestore` import (adjust the import line, don't duplicate it) — the file already imports `doc, getDoc, writeBatch` from Task 1; add `collection` and `getDocs`:

```js
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
```

Replace the `endSession` stub:

```js
  // Filled in by the next task (archive + reset today's session).
  async function endSession() {}
```

with:

```js
  // Closes out today's play: archives aggregate stats (if any games were
  // played), clears the match log, empties every court, resets every
  // player's stats and checks them all out, then signs out. Roster itself
  // is kept — this is not the destructive "New Session" wipe.
  async function endSession() {
    if (!club) return;
    const { id } = club;
    const [playersSnap, courtsSnap, matchLogSnap] = await Promise.all([
      getDocs(collection(db, "sessions", id, "players")),
      getDocs(collection(db, "sessions", id, "courts")),
      getDocs(collection(db, "sessions", id, "matchLog")),
    ]);
    const roster = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const totalGames = roster.reduce((n, p) => n + (p.games || 0), 0);
    const batch = writeBatch(db);
    if (totalGames > 0) {
      const historyRef = doc(collection(db, "sessions", id, "history"));
      batch.set(historyRef, {
        endedAt: Date.now(),
        matches: Math.round(totalGames / 2),
        players: roster.map((p) => ({
          id: p.id, name: p.name, games: p.games || 0, wins: p.wins || 0, losses: p.losses || 0,
        })),
      });
    }
    roster.forEach((p) => {
      batch.update(doc(db, "sessions", id, "players", p.id), {
        games: 0, wins: 0, losses: 0, partners: [], lastResult: null, checked: false,
      });
    });
    courtsSnap.forEach((d) => batch.update(d.ref, { teamA: [], teamB: [] }));
    matchLogSnap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    await signOut(auth);
  }
```

- [ ] **Step 2: Add the End Session button to `src/components/Sidebar.jsx`**

1. In the `lucide-react` import at the top, add `Flag` to the existing list (alongside `LogOut`, etc.).
2. Change the component's prop list from:

```js
export default function Sidebar({
  session, courtCount, mode, onChangeMode, tab, onSelectTab, onNewSession, onEditSession, onEndSession,
  open, onClose, collapsed, onToggleCollapse,
}) {
```

to:

```js
export default function Sidebar({
  session, courtCount, mode, onChangeMode, tab, onSelectTab, onNewSession, onEditSession,
  onEndSession, onSwitchClub,
  open, onClose, collapsed, onToggleCollapse,
}) {
```

3. Replace the single existing button:

```jsx
            <button className="sidebar-endsession" onClick={onEndSession} title="Switch Club">
              <LogOut /> <span>Switch Club</span>
            </button>
```

with two buttons — the strong red styling now belongs to the more consequential action (End Session), Switch Club becomes a plain button matching New Session/Collapse:

```jsx
            <button className="sidebar-endsession" onClick={onEndSession} title="End Session">
              <Flag /> <span>End Session</span>
            </button>
            <button className="outline dark" onClick={onSwitchClub} title="Switch Club">
              <LogOut /> <span>Switch Club</span>
            </button>
```

- [ ] **Step 3: Wire both actions and two confirm dialogs in `src/App.jsx`**

1. Find `const [showEndSession, setShowEndSession] = useState(false);` and add a sibling line right after it:

```js
  const [showSwitchClub, setShowSwitchClub] = useState(false);
```

2. Find the `<Sidebar` usage's `onEndSession={...}` prop and replace it with both props:

```jsx
            onEndSession={() => { setShowEndSession(true); setMenuOpen(false); }}
            onSwitchClub={() => { setShowSwitchClub(true); setMenuOpen(false); }}
```

3. Replace the existing single `{showEndSession && <ConfirmDialog .../>}` block with two blocks:

```jsx
        {showSwitchClub && (
          <ConfirmDialog
            title="Switch Club?"
            message={`This signs you out of ${session.location || club.name}. Nothing about this session changes — logging back in with the password picks up right where you left off.`}
            confirmLabel="Switch Club"
            onCancel={() => setShowSwitchClub(false)}
            onConfirm={() => { setShowSwitchClub(false); switchClub(); }}
          />
        )}
        {showEndSession && (
          <ConfirmDialog
            title="End Session?"
            message="This closes out today's play: stats are archived to Stats → Past Sessions, the match log and courts are cleared, and everyone will need to check in again next time. Signs you out."
            confirmLabel="End Session"
            onCancel={() => setShowEndSession(false)}
            onConfirm={() => { setShowEndSession(false); endSession(); }}
          />
        )}
```

- [ ] **Step 4: Verify the build compiles**

Run: `npx vite build`
Expected: `✓ built` with no errors.

- [ ] **Step 5: Manual verification — End Session with games played**

Using the Playwright MCP tools against the running dev server, on a throwaway test club (same approach as this project's earlier live-court testing — create a fresh club so no real data is touched):

1. Log in as a new test club, add 4 players, check them in, start a match on Court 1, record a win (Team 1 Wins).
2. Open the sidebar, click **End Session**, confirm the dialog.
3. Expected: lands back on the login screen.
4. In Firestore: `sessions/{id}/history` now has one new doc with `matches: 1` (2 games recorded / 2) and the 4 players' aggregate stats. `sessions/{id}/matchLog` is empty. The court doc has `teamA: []`, `teamB: []`. All 4 player docs have `games: 0, wins: 0, losses: 0, checked: false`.
5. Log back in with the same club name + password. Expected: lands on the dashboard, Court 1 shows "OPEN", Players tab shows all 4 players as "Checked out".

- [ ] **Step 6: Manual verification — End Session with zero games played (Review Focus item)**

1. Log in as a different new test club, add 2 players, check them in, do **not** start any match.
2. Click **End Session**, confirm.
3. Expected: lands on login screen. In Firestore, `sessions/{id}/history` has **no new document** — confirms the `totalGames > 0` guard prevents a junk empty archive entry.

- [ ] **Step 7: Manual verification — Switch Club stays non-destructive**

1. Log into a test club that already has players/courts, click **Switch Club**, confirm.
2. Expected: lands on login screen.
3. Log back in with the same password. Expected: everything (roster, checked-in state, live courts, stats) is exactly as it was — nothing was reset.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useClub.js src/components/Sidebar.jsx src/App.jsx
git commit -m "Add End Session (archive + reset) as a real, separate action from Switch Club"
```

---

## Task 3: Harden Firestore security rules

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: the `{slug}@courtflow.local` email pattern from Task 1 (must match exactly, including the literal string used in the rule).
- Produces: nothing consumed by later tasks — this is the last task.

- [ ] **Step 1: Replace `firestore.rules`**

Replace the whole file with:

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

- [ ] **Step 2: Deploy the rules**

Run: `npx firebase deploy --only firestore:rules --project courtflow-pickle`
Expected: `Deploy complete!`, no compile errors reported for `firestore.rules`.

- [ ] **Step 3: Verify authenticated writes still work**

Using the Playwright MCP tools against the running dev server:

1. Log into a test club (or reuse one from Task 2).
2. Add a player, check them in, start a match, record a win.
3. Expected: every one of these actions succeeds exactly as before — confirms the deployed rules don't block a signed-in club writing its own data.

- [ ] **Step 4: Verify the public Live Board still works logged-out (Review Focus item)**

1. While logged in, open the sidebar's "Share Live Board" and copy the URL (`/live?club={id}`).
2. Open that URL in a fresh incognito/private browser context (no login).
3. Expected: the live courts render normally — confirms reads are still public after the rules change.

- [ ] **Step 5: Verify an unauthenticated write is actually rejected (Review Focus item)**

The app itself never attempts a write while logged out, so this needs a direct script rather than clicking through the UI. Create a throwaway verification script (this file is deleted in Step 6, it is not part of the codebase):

`scratchpad-verify-rules.mjs` (place in the project root temporarily):

```js
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

try {
  await setDoc(doc(db, "sessions", "rules-verify-should-fail"), { probe: true });
  console.error("FAIL: unauthenticated write succeeded — rules are not enforcing auth.");
  process.exit(1);
} catch (err) {
  if (err.code === "permission-denied") {
    console.log("PASS: unauthenticated write was rejected with permission-denied.");
  } else {
    console.error(`FAIL: unexpected error code: ${err.code}`);
    process.exit(1);
  }
}
```

Run it with the project's env values loaded (adjust for how this shell reads `.env` — e.g. with `dotenv-cli` if available, or by pasting the three values inline for this one-off run):

```bash
node --env-file=.env scratchpad-verify-rules.mjs
```

Expected output: `PASS: unauthenticated write was rejected with permission-denied.`

- [ ] **Step 6: Delete the throwaway script**

```bash
rm scratchpad-verify-rules.mjs
```

- [ ] **Step 7: Commit**

```bash
git add firestore.rules
git commit -m "Harden Firestore rules: writes require the club's own Firebase Auth account"
```
