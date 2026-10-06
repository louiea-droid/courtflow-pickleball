# Accounts, Sign-in and Hub Implementation Plan (Step 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host can create an account (email + password or Google), sign in, reach a hub of feature cards, and edit account-level settings. Today's club app keeps working, unchanged, at `/club`.

**Architecture:** New accounts are plain Firebase Auth users with a profile doc at `accounts/{uid}`. A small route table in `src/utils/route.js` picks the page in `main.jsx`: `/live`, `/open-play`, `/club` (the existing app) and everything else goes to a new `AccountApp` (sign-in, hub, settings). Legacy club users (`@courtflow.local` emails) are never treated as accounts and real accounts are never treated as clubs. Security rules gain an owner-only `accounts/{uid}/**` block, tested in the Firestore emulator with a test script that lives in the repo.

**Tech Stack:** React 19, Vite, Firebase Auth + Firestore (already installed), lucide-react, Firestore emulator + `@firebase/rules-unit-testing` (new dev dependency, needs Java, already installed).

**Spec:** `docs/superpowers/specs/2026-10-06-accounts-and-events-design.md` (this plan is its build-order step 1). Steps 2 to 4 get their own plans after this ships.

## Global Constraints

- Every color is a token on `:root` in `src/styles.css` (`var(--accent)`, `var(--line)`…). Never raw hex. (CLAUDE.md)
- No avatar-initial badges next to names. Plain names only.
- Money shows through `money()` and times through `utils/format.js` formatters.
- Use only the packages already installed, plus `@firebase/rules-unit-testing` as a devDependency. No router library.
- Copy: sentence case, active voice, errors say what went wrong and what to do. Same action keeps the same name ("Sign in", not "Log in" in one place).
- Legacy files `src/App.jsx`, `src/hooks/useClub.js`, `src/components/ClubLogin.jsx` change only where this plan says so.
- Firestore reads of club data stay as today (public). `accounts/**` is owner-only in this step.
- Commit steps assume you have approved committing (this project's rule is "commit only when asked"). End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Inputs and conditions the spec implies but the happy path will not exercise, most likely first:

1. **Google window closed or blocked.** Closing the popup must show nothing (not an error); a blocked popup says to allow pop-ups. Pinned by `account.check.mjs` (Task 2).
2. **Password reset for an email with no account.** Must look identical to success ("If an account exists, we sent a link"), so nobody can probe which emails are registered. Pinned by `account.check.mjs` (Task 2).
3. **Old club login vs new account on the same browser.** A signed-in `@courtflow.local` user opening `/` must see sign-in (not a broken account), and a real account opening `/club` must see the club login. Pinned by `account.check.mjs` (Task 2) and the `useClub` guard (Task 3).
4. **Refresh and deep links.** Reloading while signed in must show "Loading…", never flash the sign-in form; opening `/settings` signed out must land on `/settings` after signing in; an unknown path falls back to the hub. Pinned by `route.check.mjs` (Task 2) and the manual checks in Task 7.
5. **Google-only accounts have no password.** No "Change password" row; deleting the account re-authenticates with Google instead of a password. Pinned by `hasPasswordProvider` in `account.check.mjs` (Task 2) and Task 6.

---

## File Structure

| File | Responsibility |
|---|---|
| `tests/rules.test.mjs` (new) | Emulator test of every Firestore rule: clubs, bookings, requests, accounts. |
| `firestore.rules` (modify) | Adds `accounts/{uid}/**` owner-only. |
| `src/utils/account.js` (new) | Pure helpers: `isAccountUser`, `hasPasswordProvider`, `defaultClubName`, `authMessage`, `resetMessage`. |
| `src/utils/account.check.mjs` (new) | Self-check for the above. |
| `src/utils/route.js` (new) | `routeOf(pathname)` returns the page name. |
| `src/utils/route.check.mjs` (new) | Self-check for routing. |
| `src/hooks/useRoute.js` (new) | `{ route, navigate }` over `history.pushState`. |
| `src/hooks/useAccount.js` (new) | Auth state, account doc, and every account action. |
| `src/hooks/useClub.js` (modify) | Ignore real-account users. Delete cascade untouched. |
| `src/components/AccountLogin.jsx` (new) | Sign in / create account / reset password / Google. |
| `src/views/Hub.jsx` (new) | Feature cards. |
| `src/AccountApp.jsx` (new) | Shell: header, routing between login, hub, settings; toast; delete dialog. |
| `src/main.jsx` (modify) | Picks the page via `routeOf`. |
| `src/views/Settings.jsx` (modify) | `mode="account"` hides club-only rows. |
| `src/components/DeleteAccountDialog.jsx` (modify) | Account wording, optional password field. |
| `src/styles.css` (modify) | Sign-in extras, hub, shell. |
| `CLAUDE.md` (modify) | Document accounts and the route table. |

## Before you start

- [ ] **Commit the open-play booking work.** It is uncommitted on this branch. Run `git status`; if `src/OpenPlay.jsx` and `src/views/Bookings.jsx` show as untracked/modified, commit them first so this plan's diffs stay readable:

```bash
git add -A
git commit -m "feat: open play bookings, public booking page, join requests" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Turn on sign-in methods** (Firebase console, your project, Build → Authentication → Sign-in method): Email/Password should already be on (the old club login uses it). Turn on **Google** and pick a support email. `localhost` is already an authorized domain; add your live domain under Settings → Authorized domains before deploying.

---

### Task 1: Rules test harness and account rules

**Files:**
- Create: `tests/rules.test.mjs`
- Modify: `firestore.rules`
- Modify: `package.json` (devDependency + script)

**Interfaces:**
- Produces: `npm run test:rules` runs every rule assertion in the emulator and prints `rules: all assertions passed`. Later steps add cases to this file.

- [ ] **Step 1: Install the test dependency and add the script**

```bash
npm install --save-dev @firebase/rules-unit-testing
```

In `package.json`, add to `"scripts"`:

```json
"test:rules": "firebase emulators:exec --only firestore --project rules-test \"node tests/rules.test.mjs\""
```

- [ ] **Step 2: Write the test file (includes the new account cases, which fail first)**

Create `tests/rules.test.mjs`:

```js
// Firestore rules test. Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const rules = fs.readFileSync(process.env.RULES || "firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "rules-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "sessions/club1/bookings/b1"), { title: "x", attendees: [] });
  await setDoc(doc(db, "sessions/club1/players/p1"), { name: "P" });
  await setDoc(doc(db, "accounts/u1"), { clubName: "One" });
  await setDoc(doc(db, "accounts/u1/roster/r1"), { name: "Regular" });
});

const anon = env.unauthenticatedContext().firestore();
const club1 = env.authenticatedContext("c1", { email: "club1@courtflow.local" }).firestore();
const club2 = env.authenticatedContext("c2", { email: "club2@courtflow.local" }).firestore();
const u1 = env.authenticatedContext("u1", { email: "one@example.com" }).firestore();
const u2 = env.authenticatedContext("u2", { email: "two@example.com" }).firestore();

// ---- Legacy clubs and open-play requests (sessions/**) ----
const good = { bookingId: "b1", name: "Dee", contact: "0917", method: "online", ref: "GC1", status: "pending", createdAt: Date.now() };
const cash = { ...good, method: "cash" }; delete cash.ref;
const req = (db, id) => doc(db, "sessions/club1/bookingRequests", id);

await assertSucceeds(setDoc(req(anon, "r1"), good));
await assertSucceeds(setDoc(req(anon, "r2"), cash));
await assertFails(setDoc(req(anon, "r3"), { ...good, status: "approved" }));
await assertFails(setDoc(req(anon, "r4"), { ...good, extra: 1 }));
await assertFails(setDoc(req(anon, "r5"), { ...good, bookingId: "nope" }));
await assertFails(setDoc(req(anon, "r6"), { ...good, name: "x".repeat(61) }));
await assertFails(setDoc(req(anon, "r7"), { ...good, name: "" }));
await assertFails(setDoc(req(anon, "r8"), { ...good, method: "bitcoin" }));
await assertFails(setDoc(req(anon, "r9"), { ...good, createdAt: "now" }));
await assertSucceeds(getDoc(req(anon, "r1")));
await assertFails(getDocs(collection(anon, "sessions/club1/bookingRequests")));
await assertFails(updateDoc(req(anon, "r1"), { status: "approved" }));
await assertFails(deleteDoc(req(anon, "r1")));
await assertFails(setDoc(req(anon, "r1"), good));
await assertSucceeds(getDoc(doc(anon, "sessions/club1/bookings/b1")));
await assertSucceeds(getDocs(collection(anon, "sessions/club1/players")));
await assertFails(setDoc(doc(anon, "sessions/club1/bookings/b2"), { title: "evil" }));
await assertFails(updateDoc(doc(anon, "sessions/club1/players/p1"), { name: "evil" }));
await assertSucceeds(getDocs(collection(club1, "sessions/club1/bookingRequests")));
await assertSucceeds(updateDoc(req(club1, "r1"), { status: "approved" }));
await assertSucceeds(setDoc(doc(club1, "sessions/club1/bookings/b3"), { title: "ok" }));
await assertFails(getDocs(collection(club2, "sessions/club1/bookingRequests")));
await assertFails(setDoc(doc(club2, "sessions/club1/bookings/b4"), { title: "no" }));

// ---- Accounts (accounts/{uid}/**): owner only, nothing public ----
await assertSucceeds(getDoc(doc(u1, "accounts/u1")));
await assertSucceeds(setDoc(doc(u1, "accounts/u1"), { clubName: "One", createdAt: 1 }));
await assertSucceeds(updateDoc(doc(u1, "accounts/u1"), { clubName: "One!" }));
await assertSucceeds(getDocs(collection(u1, "accounts/u1/roster")));
await assertSucceeds(setDoc(doc(u1, "accounts/u1/roster/r2"), { name: "New" }));
await assertSucceeds(setDoc(doc(u2, "accounts/u2"), { clubName: "Two" }));
await assertFails(getDoc(doc(u2, "accounts/u1")));
await assertFails(setDoc(doc(u2, "accounts/u1"), { clubName: "stolen" }));
await assertFails(getDocs(collection(u2, "accounts/u1/roster")));
await assertFails(setDoc(doc(u2, "accounts/u1/roster/r3"), { name: "evil" }));
await assertFails(getDoc(doc(anon, "accounts/u1")));
await assertFails(getDoc(doc(anon, "accounts/u1/roster/r1")));
await assertFails(setDoc(doc(anon, "accounts/u3"), { clubName: "anon" }));
// A legacy club login is not an account owner.
await assertFails(getDoc(doc(club1, "accounts/u1")));

console.log("rules: all assertions passed");
await env.cleanup();
```

- [ ] **Step 3: Run it to verify the account cases fail**

Run: `npm run test:rules`
Expected: FAIL at the first account assertion (`assertSucceeds(getDoc(doc(u1, "accounts/u1")))`), because `firestore.rules` has no `accounts` block yet. The legacy assertions before it must pass.

- [ ] **Step 4: Add the account rules**

In `firestore.rules`, add inside `match /databases/{database}/documents {`, after the `match /sessions/{sessionId} { ... }` block:

```
    // Accounts: everything under accounts/{uid} belongs to that signed-in user.
    // Step 2 loosens this for events (public read) and join requests.
    match /accounts/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
```

- [ ] **Step 4b: Run it to verify it passes**

Run: `npm run test:rules`
Expected: `rules: all assertions passed` (Firestore logs `PERMISSION_DENIED` lines for the expected failures; ignore them).

- [ ] **Step 5: Commit**

```bash
git add tests/rules.test.mjs firestore.rules package.json package-lock.json
git commit -m "feat: owner-only account rules and a repo rules test" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Account and route helpers

**Files:**
- Create: `src/utils/account.js`, `src/utils/account.check.mjs`
- Create: `src/utils/route.js`, `src/utils/route.check.mjs`
- Create: `src/hooks/useRoute.js`

**Interfaces:**
- Produces from `src/utils/account.js`:
  - `isAccountUser(user: {email?: string}|null): boolean`
  - `hasPasswordProvider(user: {providerData: {providerId: string}[]}): boolean`
  - `defaultClubName(user: {displayName?: string, email: string}): string`
  - `authMessage(err: {code?: string}): string` (empty string means show nothing)
  - `resetMessage(err: {code?: string}): string`
- Produces from `src/utils/route.js`: `routeOf(pathname: string): "live" | "open-play" | "club" | "settings" | "hub"`
- Produces from `src/hooks/useRoute.js`: `useRoute(): { route: string, navigate: (to: string) => void }`

- [ ] **Step 1: Write the failing checks**

Create `src/utils/account.check.mjs`:

```js
// Self-check for account helpers. Run: node src/utils/account.check.mjs
import assert from "node:assert";
import { authMessage, defaultClubName, hasPasswordProvider, isAccountUser, resetMessage } from "./account.js";

// Legacy club logins use fake @courtflow.local emails and are never accounts.
assert.equal(isAccountUser({ email: "host@gmail.com" }), true);
assert.equal(isAccountUser({ email: "centro-pickle@courtflow.local" }), false);
assert.equal(isAccountUser({ email: "CENTRO@COURTFLOW.LOCAL" }), false);
assert.equal(isAccountUser(null), false);
assert.equal(isAccountUser({ email: null }), false);

// Google-only accounts have no password to change or confirm.
assert.equal(hasPasswordProvider({ providerData: [{ providerId: "google.com" }] }), false);
assert.equal(hasPasswordProvider({ providerData: [{ providerId: "password" }, { providerId: "google.com" }] }), true);

assert.equal(defaultClubName({ displayName: "  Centro Pickle  ", email: "a@b.co" }), "Centro Pickle");
assert.equal(defaultClubName({ displayName: null, email: "louie.a@mail.com" }), "louie.a");

// Closing the Google window is not an error; a blocked window says what to do.
assert.equal(authMessage({ code: "auth/popup-closed-by-user" }), "");
assert.equal(authMessage({ code: "auth/cancelled-popup-request" }), "");
assert.match(authMessage({ code: "auth/popup-blocked" }), /pop-ups/);
// Wrong password and unknown email read the same, so sign-in can't be used to probe accounts.
assert.equal(authMessage({ code: "auth/wrong-password" }), authMessage({ code: "auth/user-not-found" }));
assert.equal(authMessage({ code: "auth/invalid-credential" }), authMessage({ code: "auth/user-not-found" }));
assert.match(authMessage({ code: "auth/email-already-in-use" }), /already exists/);
assert.match(authMessage({ code: "auth/weak-password" }), /6 characters/);
assert.match(authMessage({ code: "auth/network-request-failed" }), /connection/);
assert.match(authMessage({ code: "auth/too-many-requests" }), /Wait/);
assert.match(authMessage(new Error("boom")), /try again/);
assert.match(authMessage(undefined), /try again/);

// Reset never reveals whether an email has an account.
assert.equal(resetMessage({ code: "auth/user-not-found" }), "");
assert.match(resetMessage({ code: "auth/invalid-email" }), /email/);
assert.match(resetMessage({ code: "auth/network-request-failed" }), /connection/);

console.log("account.check: ok");
```

Create `src/utils/route.check.mjs`:

```js
// Self-check for routing. Run: node src/utils/route.check.mjs
import assert from "node:assert";
import { routeOf } from "./route.js";

assert.equal(routeOf("/"), "hub");
assert.equal(routeOf(""), "hub");
assert.equal(routeOf("/settings"), "settings");
assert.equal(routeOf("/settings/"), "settings");
assert.equal(routeOf("/club"), "club");
assert.equal(routeOf("/club/"), "club");
assert.equal(routeOf("/live"), "live");
assert.equal(routeOf("/open-play"), "open-play");
assert.equal(routeOf("/open-play/"), "open-play");
// Unknown paths fall back to the hub rather than a blank page.
assert.equal(routeOf("/nope"), "hub");
assert.equal(routeOf("/settings/extra"), "hub");
assert.equal(routeOf("/clubhouse"), "hub");

console.log("route.check: ok");
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node src/utils/account.check.mjs; node src/utils/route.check.mjs`
Expected: both FAIL with `ERR_MODULE_NOT_FOUND` for `account.js` / `route.js`.

- [ ] **Step 3: Implement**

Create `src/utils/account.js`:

```js
// Helpers for real accounts (email/Google). Legacy club logins use fake
// emails on this domain and must never be mistaken for an account.
export const LEGACY_DOMAIN = "@courtflow.local";

export const isAccountUser = (user) =>
  Boolean(user?.email) && !user.email.toLowerCase().endsWith(LEGACY_DOMAIN);

// Google-only accounts have no password, so no password change or password confirm.
export const hasPasswordProvider = (user) =>
  user.providerData.some((p) => p.providerId === "password");

export const defaultClubName = (user) => user.displayName?.trim() || user.email.split("@")[0];

const MESSAGES = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-password": "Enter your password.",
  // Same text for all three so sign-in can't be used to find out which emails have accounts.
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a bit before trying again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/operation-not-allowed": "This sign-in method isn't turned on yet. Contact the admin.",
  "auth/requires-recent-login": "For safety, sign in again and then retry.",
};
// The person closed the Google window on purpose: nothing to report.
const QUIET = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export function authMessage(err) {
  const code = err?.code;
  if (QUIET.has(code)) return "";
  return MESSAGES[code] || "Something went wrong. Please try again.";
}

// Reset says the same thing whether or not the email has an account.
export const resetMessage = (err) => (err?.code === "auth/user-not-found" ? "" : authMessage(err));
```

Create `src/utils/route.js`:

```js
// Which page a path belongs to. main.jsx uses it to pick the page; AccountApp
// uses it for hub vs settings. Unknown paths go to the hub.
export function routeOf(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/live") return "live";
  if (path === "/open-play") return "open-play";
  if (path === "/club") return "club";
  if (path === "/settings") return "settings";
  return "hub";
}
```

Create `src/hooks/useRoute.js`:

```js
import { useEffect, useState } from "react";
import { routeOf } from "../utils/route";

export function useRoute() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = (to) => {
    window.history.pushState({}, "", to);
    setPath(to);
  };
  return { route: routeOf(path), navigate };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `node src/utils/account.check.mjs && node src/utils/route.check.mjs`
Expected: `account.check: ok` then `route.check: ok`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/account.js src/utils/account.check.mjs src/utils/route.js src/utils/route.check.mjs src/hooks/useRoute.js
git commit -m "feat: account and route helpers with self-checks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The account hook and the legacy guard

**Files:**
- Create: `src/hooks/useAccount.js`
- Modify: `src/hooks/useClub.js:29-46` and imports

**Interfaces:**
- Consumes: everything exported by `src/utils/account.js` (Task 2).
- Produces `useAccount()` returning:
  - `status: "loading" | "out" | "in"`
  - `user` (Firebase user or null), `account` (the `accounts/{uid}` data or null), `hasPassword: boolean`
  - `signIn(email, password): Promise<string>`, `signUp(clubName, email, password): Promise<string>`, `signInGoogle(): Promise<string>`, `resetPassword(email): Promise<string>`, `signOutUser(): Promise<void>`
  - `updateAccount(patch: object): Promise<void>`, `changePassword(current, next): Promise<string>`, `deleteAccount(password: string): Promise<string>`
  - Every `Promise<string>` resolves to `""` on success or a message to show.

- [ ] **Step 1: Guard the legacy hook**

In `src/hooks/useClub.js`, add to the imports (below the existing `../utils/club` import):

```js
import { isAccountUser } from "../utils/account";
```

Then change the start of the `onAuthStateChanged` callback (currently `if (!user) {`) to:

```js
      // A real account (email/Google) is not a club. Treat it as signed out here
      // so the club login shows instead of reading a club named after its email.
      if (!user || isAccountUser(user)) {
```

- [ ] **Step 2: Write the hook**

Create `src/hooks/useAccount.js`:

```js
import { useEffect, useRef, useState } from "react";
import {
  EmailAuthProvider, GoogleAuthProvider, createUserWithEmailAndPassword, deleteUser, onAuthStateChanged,
  reauthenticateWithCredential, reauthenticateWithPopup, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut, updatePassword,
} from "firebase/auth";
import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, query, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "../firebase";
import { authMessage, defaultClubName, hasPasswordProvider, isAccountUser, resetMessage } from "../utils/account";

// Step 2 adds each event's own subcollections to this cascade.
const ACCOUNT_COLLECTIONS = ["roster", "events"];

// Creates accounts/{uid} once. Safe to call again: it never overwrites settings.
async function ensureAccount(user, clubName) {
  const ref = doc(db, "accounts", user.uid);
  if ((await getDoc(ref)).exists()) return;
  await setDoc(ref, { clubName: clubName || defaultClubName(user), email: user.email, createdAt: Date.now() });
}

// Firestore batches cap at 500 writes, so delete in rounds.
async function wipeCollection(colRef) {
  for (;;) {
    const snap = await getDocs(query(colRef, limit(400)));
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

const run = async (fn) => {
  try {
    await fn();
    return "";
  } catch (err) {
    return authMessage(err);
  }
};

export function useAccount() {
  const [user, setUser] = useState(undefined); // undefined = still checking who's signed in
  const [account, setAccount] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const creating = useRef(false); // sign-up writes the account itself; don't race it

  useEffect(() => {
    if (!firebaseConfigured) { setUser(null); return; }
    return onAuthStateChanged(auth, (u) => setUser(isAccountUser(u) ? u : null));
  }, []);

  useEffect(() => {
    setLoaded(false);
    if (!user) { setAccount(null); return; }
    return onSnapshot(doc(db, "accounts", user.uid), (s) => {
      setAccount(s.exists() ? s.data() : null);
      setLoaded(true);
      // Signed in but no profile yet (e.g. made in the console): create it.
      if (!s.exists() && !creating.current) ensureAccount(user).catch(() => {});
    });
  }, [user]);

  const status = user === undefined || (user && !(loaded && account)) ? "loading" : user ? "in" : "out";

  const signIn = (email, password) => run(async () => {
    const { user: u } = await signInWithEmailAndPassword(auth, email.trim(), password);
    await ensureAccount(u);
  });

  const signUp = (clubName, email, password) => run(async () => {
    creating.current = true;
    try {
      const { user: u } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await ensureAccount(u, clubName.trim());
    } finally {
      creating.current = false;
    }
  });

  const signInGoogle = () => run(async () => {
    const { user: u } = await signInWithPopup(auth, new GoogleAuthProvider());
    await ensureAccount(u);
  });

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return "";
    } catch (err) {
      return resetMessage(err);
    }
  };

  const updateAccount = (patch) => updateDoc(doc(db, "accounts", user.uid), patch);

  const changePassword = async (current, next) => {
    try {
      await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, current));
    } catch (err) {
      return err.code === "auth/too-many-requests" || err.code === "auth/network-request-failed"
        ? authMessage(err) : "Current password is incorrect.";
    }
    return run(() => updatePassword(auth.currentUser, next));
  };

  // Proves it's you first (password, or the Google window), then erases the
  // account's data, then the sign-in itself. Data first, account last, so a
  // failure never leaves data orphaned behind a deleted login.
  const deleteAccount = async (password) => {
    try {
      if (hasPasswordProvider(auth.currentUser)) {
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, password));
      } else {
        await reauthenticateWithPopup(auth.currentUser, new GoogleAuthProvider());
      }
    } catch (err) {
      return err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request"
        ? "Confirm with Google to delete your account."
        : err.code === "auth/too-many-requests" || err.code === "auth/network-request-failed" || err.code === "auth/popup-blocked"
          ? authMessage(err) : "Password is incorrect.";
    }
    return run(async () => {
      const uid = auth.currentUser.uid;
      for (const name of ACCOUNT_COLLECTIONS) await wipeCollection(collection(db, "accounts", uid, name));
      const batch = writeBatch(db);
      batch.delete(doc(db, "accounts", uid));
      await batch.commit();
      await deleteUser(auth.currentUser);
    });
  };

  return {
    status, user, account, hasPassword: user ? hasPasswordProvider(user) : false,
    signIn, signUp, signInGoogle, resetPassword, signOutUser: () => signOut(auth),
    updateAccount, changePassword, deleteAccount,
  };
}
```

- [ ] **Step 3: Verify it builds and the legacy guard works**

Run: `npx vite build`
Expected: build succeeds (no import errors). `useAccount` is not mounted anywhere yet, so there is nothing to click; Task 5 exercises it.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useAccount.js src/hooks/useClub.js
git commit -m "feat: useAccount hook, and the club hook ignores real accounts" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The sign-in screen

**Files:**
- Create: `src/components/AccountLogin.jsx`
- Modify: `src/styles.css` (append)

**Interfaces:**
- Consumes: the `Promise<string>` actions from `useAccount` (Task 3).
- Produces: `<AccountLogin onSignIn onSignUp onGoogle onReset />` where `onSignIn(email, password)`, `onSignUp(clubName, email, password)`, `onGoogle()`, `onReset(email)` each resolve to `""` or an error message.

- [ ] **Step 1: Write the component**

Create `src/components/AccountLogin.jsx`:

```jsx
import { useState } from "react";
import { LogIn, Moon, Sun, UserPlus } from "lucide-react";
import { isDarkTheme, setDeviceTheme } from "../utils/theme";

const COPY = {
  signin: { title: "Sign in", blurb: "Sign in to host open play and run your games.", action: "Sign in", icon: LogIn },
  signup: { title: "Create your account", blurb: "One account for your club, your players and every open play.", action: "Create account", icon: UserPlus },
  reset: { title: "Reset your password", blurb: "Enter your email and we'll send you a link to choose a new password.", action: "Send reset link", icon: LogIn },
};

export default function AccountLogin({ onSignIn, onSignUp, onGoogle, onReset }) {
  const [mode, setMode] = useState("signin");
  const [clubName, setClubName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [dark, setDark] = useState(isDarkTheme);
  const toggleTheme = () => { setDeviceTheme(dark ? "light" : "dark"); setDark(!dark); };
  const { title, blurb, action, icon: Icon } = COPY[mode];

  const go = (next) => { setMode(next); setError(""); setInfo(""); };

  // Every action resolves to "" or a message; busy blocks double submits.
  const attempt = async (fn, done) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setInfo("");
    const message = await fn();
    setBusy(false);
    if (message) setError(message);
    else done?.();
  };

  const submit = (e) => {
    e.preventDefault();
    if (mode === "signin") attempt(() => onSignIn(email, password));
    else if (mode === "signup") attempt(() => onSignUp(clubName, email, password));
    else attempt(() => onReset(email), () => setInfo("If an account exists for that email, we've sent a link to reset the password."));
  };

  const ready = email.trim() && (mode === "reset" || password) && (mode !== "signup" || clubName.trim());

  return (
    <div className="clublogin">
      <form className="clublogin-card" onSubmit={submit}>
        <img className="mark" src="/images/courtflow.png" alt="" />
        <h1>{title}</h1>
        <p>{blurb}</p>

        {mode === "signup" && (
          <label>
            Club or host name
            <input value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="e.g. Centro Pickle Club" autoComplete="organization" autoFocus />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus={mode !== "signup"} />
        </label>
        {mode !== "reset" && (
          <label>
            Password
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>
        )}

        {error && <p className="clublogin-error" role="alert">{error}</p>}
        {info && <p className="clublogin-info" role="status">{info}</p>}

        <button className="primary" disabled={busy || !ready}>
          <Icon size={16} /> {busy ? "Please wait…" : action}
        </button>

        {mode !== "reset" && (
          <>
            <div className="clublogin-divider"><span>or</span></div>
            <button type="button" className="outline clublogin-google" disabled={busy} onClick={() => attempt(onGoogle)}>
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.4-4.8 7.1l7.6 5.9c4.4-4.1 7-10.1 7-17.5z" />
                <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              Continue with Google
            </button>
          </>
        )}

        <div className="clublogin-switch">
          {mode === "signin" && (
            <>
              <button type="button" className="text" onClick={() => go("signup")}>Create an account</button>
              <button type="button" className="text" onClick={() => go("reset")}>Forgot password?</button>
            </>
          )}
          {mode !== "signin" && <button type="button" className="text" onClick={() => go("signin")}>Back to sign in</button>}
        </div>
      </form>
      <button
        type="button" className="icon theme-toggle" onClick={toggleTheme}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add the styles**

Append to `src/styles.css`:

```css

/* ---------- Accounts: sign-in extras ---------- */
.clublogin-google{width:100%;justify-content:center;gap:9px}
.clublogin-divider{display:flex;align-items:center;gap:10px;color:var(--faint);font-size:11.5px}
.clublogin-divider::before,.clublogin-divider::after{content:"";flex:1;height:1px;background:var(--line)}
.clublogin-switch{display:flex;justify-content:center;flex-wrap:wrap;gap:6px 16px}
.clublogin-info{margin:0;color:var(--accent-ink);font-weight:700;font-size:13px;line-height:1.45}
```

- [ ] **Step 3: Verify it builds**

Run: `npx vite build`
Expected: success. (The component is mounted in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add src/components/AccountLogin.jsx src/styles.css
git commit -m "feat: account sign-in screen (email, Google, reset)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Hub, shell and routing

**Files:**
- Create: `src/views/Hub.jsx`, `src/AccountApp.jsx`
- Modify: `src/main.jsx`
- Modify: `src/styles.css` (append)

**Interfaces:**
- Consumes: `useAccount` (Task 3), `AccountLogin` (Task 4), `useRoute` and `routeOf` (Task 2), existing `Toast`, `applyDisplayPrefs`, `applyTheme`, `DEFAULT_DISPLAY`.
- Produces: `<Hub clubName navigate />`; `AccountApp` (default export) renders sign-in, hub, or settings. The settings route renders a placeholder in this task and the real page in Task 6.

- [ ] **Step 1: Write the hub**

Create `src/views/Hub.jsx`:

```jsx
import { CalendarDays, ListOrdered, Settings, Users } from "lucide-react";

// `soon` cards are the next build steps; the classic club app stays reachable
// at /club until open play events replace it.
const CARDS = [
  { key: "host", icon: CalendarDays, title: "Host open play", body: "Schedule open play, take bookings and payments, then run the game.", soon: true },
  { key: "players", icon: Users, title: "Players", body: "Your roster, remembered across every open play.", soon: true },
  { key: "settings", icon: Settings, title: "Settings", body: "Club name, theme, queue rules and cost defaults.", to: "/settings" },
  { key: "club", icon: ListOrdered, title: "Classic club session", body: "The queue app you use today, until open play events replace it.", href: "/club" },
];

export default function Hub({ clubName, navigate }) {
  return (
    <>
      <h1>{clubName}</h1>
      <p>What would you like to do?</p>
      <div className="hub-grid">
        {CARDS.map(({ key, icon: Icon, title, body, soon, to, href }) => {
          const inner = (
            <>
              <Icon size={22} />
              <b>{title}</b>
              <span>{body}</span>
              {soon && <em className="pill off">Coming soon</em>}
            </>
          );
          if (soon) return <button key={key} className="hub-card" disabled>{inner}</button>;
          if (href) return <a key={key} className="hub-card" href={href}>{inner}</a>;
          return (
            <a key={key} className="hub-card" href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>{inner}</a>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Write the shell**

Create `src/AccountApp.jsx`:

```jsx
import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useAccount } from "./hooks/useAccount";
import { useRoute } from "./hooks/useRoute";
import { applyDisplayPrefs } from "./utils/format";
import { applyTheme } from "./utils/theme";
import { DEFAULT_DISPLAY } from "./data/constants";
import AccountLogin from "./components/AccountLogin";
import Toast from "./components/Toast";
import Hub from "./views/Hub";

export default function AccountApp() {
  const acct = useAccount();
  const { route, navigate } = useRoute();
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = (message, ms = 2200) => {
    clearTimeout(toastTimer.current);
    setToast({ message, action: null });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const dismissToast = () => { clearTimeout(toastTimer.current); setToast(null); };

  const display = { ...DEFAULT_DISPLAY, ...acct.account?.display };
  applyDisplayPrefs(display);
  // Not before the account loads: defaults would flash Light over the cached theme.
  if (acct.status === "in") applyTheme(display);

  if (acct.status === "loading") {
    return <div className="loading"><span className="spinner" />Loading…</div>;
  }
  if (acct.status === "out") {
    return (
      <AccountLogin
        onSignIn={acct.signIn} onSignUp={acct.signUp} onGoogle={acct.signInGoogle} onReset={acct.resetPassword}
      />
    );
  }

  const go = (to) => (e) => { e.preventDefault(); navigate(to); };

  return (
    <div className="acct-shell">
      <header className="acct-bar">
        <a className="acct-brand" href="/" onClick={go("/")}>
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </a>
        <nav aria-label="Account">
          <a href="/" className={route === "hub" ? "active" : ""} onClick={go("/")}>Home</a>
          <a href="/settings" className={route === "settings" ? "active" : ""} onClick={go("/settings")}>Settings</a>
        </nav>
        <button className="outline" onClick={acct.signOutUser}><LogOut size={14} /> Sign out</button>
      </header>
      <main className="acct-main">
        {route === "settings"
          ? <p>Settings arrive in the next task.</p>
          : <Hub clubName={acct.account.clubName} navigate={navigate} />}
      </main>
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
```

(`notify` is used by Task 6; leaving it defined now is fine, an unused-variable hint is expected until then.)

- [ ] **Step 3: Route `main.jsx` through `routeOf`**

Replace the whole of `src/main.jsx` with:

```jsx
import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { routeOf } from "./utils/route";

const App = lazy(() => import("./App"));
const LiveBoard = lazy(() => import("./LiveBoard"));
const OpenPlay = lazy(() => import("./OpenPlay"));
const AccountApp = lazy(() => import("./AccountApp"));

// /club is the existing club app; the hub and settings live in AccountApp.
const pages = { live: LiveBoard, "open-play": OpenPlay, club: App };
const Page = pages[routeOf(window.location.pathname)] || AccountApp;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading"><span className="spinner" />Loading…</div>}>
      <Page />
    </Suspense>
  </React.StrictMode>
);
```

- [ ] **Step 4: Add the styles**

Append to `src/styles.css`:

```css

/* ---------- Accounts: shell and hub ---------- */
.acct-shell{min-height:100vh}
.acct-bar{
  display:flex;align-items:center;gap:clamp(10px,3vw,24px);padding:10px clamp(16px,4vw,40px);
  border-bottom:1px solid var(--line);background:var(--panel)
}
.acct-brand{display:flex;align-items:center;gap:9px;color:var(--ink);text-decoration:none;font:700 16px "Space Grotesk"}
.acct-brand img{height:28px;width:auto}
.acct-bar nav{display:flex;gap:4px;margin-right:auto}
.acct-bar nav a{padding:8px 12px;border-radius:9px;color:var(--ink-2);text-decoration:none;font-weight:700;font-size:13.5px}
.acct-bar nav a:hover{background:var(--soft)}
.acct-bar nav a.active{background:var(--accent-soft);color:var(--accent-ink)}
.acct-main{max-width:920px;margin:0 auto;padding:30px clamp(16px,4vw,40px) 72px}
.acct-main>h1{font:700 30px "Space Grotesk";letter-spacing:-.6px;margin:0 0 4px}
.acct-main>p{margin:0 0 22px;color:var(--muted)}
.hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.hub-card{
  display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:18px;text-align:left;
  border:1px solid var(--line);border-radius:17px;background:var(--panel);color:var(--ink);text-decoration:none;
  box-shadow:var(--shadow-sm);font:inherit;
  transition:transform .15s var(--ease),box-shadow .18s ease,border-color .15s ease
}
.hub-card svg{color:var(--accent-2)}
.hub-card b{font:700 17px "Space Grotesk"}
.hub-card span{color:var(--muted);font-size:13px;line-height:1.45}
.hub-card em{font-style:normal}
a.hub-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);border-color:var(--accent-line)}
.hub-card:disabled{opacity:.6;cursor:not-allowed}
@media(max-width:560px){
  .acct-bar{flex-wrap:wrap}
  .acct-bar nav{order:3;width:100%}
}
```

- [ ] **Step 5: Verify in the browser**

Run: `npx vite --port 5199` (leave running). Open `http://localhost:5199/` and check each item:
1. First paint shows "Loading…" then the sign-in form (not a flash of anything else).
2. Choose "Create an account", enter club name `ZZ Test Club`, a throwaway email you control, a 6+ character password → lands on the hub titled `ZZ Test Club` with four cards (two "Coming soon" and disabled).
3. Reload the page: "Loading…" then the hub (never the sign-in form).
4. Click Settings in the header → URL becomes `/settings`, placeholder text shows, browser Back returns to `/`.
5. Open `http://localhost:5199/settings` directly in a new tab while signed in → placeholder. Sign out, then open `/settings`: sign-in form; sign in → still on `/settings`.
6. Open `http://localhost:5199/club`: the old club login shows (you are not mistaken for a club). Open `/live?club=anything` and `/open-play?club=anything`: unchanged behaviour.
7. In Firebase console → Firestore, `accounts/{uid}` exists with `clubName`, `email`, `createdAt`.
8. "Forgot password?" with an email that has no account shows the same "If an account exists…" message; a malformed email shows "That email address doesn't look right."
9. "Continue with Google": sign in, hub shows; close the Google window mid-flow once: no error text appears.

Expected: all nine behave as described. Fix any deviation before committing.

- [ ] **Step 6: Commit**

```bash
git add src/views/Hub.jsx src/AccountApp.jsx src/main.jsx src/styles.css
git commit -m "feat: account hub, shell and route table" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Account settings and delete

**Files:**
- Modify: `src/views/Settings.jsx`
- Modify: `src/components/DeleteAccountDialog.jsx`
- Modify: `src/AccountApp.jsx`
- Modify: `src/styles.css` (append one rule)

**Interfaces:**
- Consumes: `useAccount()` actions (`updateAccount`, `changePassword`, `deleteAccount`, `hasPassword`).
- Produces: `Settings` accepts `mode: "club" | "account"` (default `"club"`) and `canChangePassword: boolean` (default `true`). In `"account"` mode it hides the password-hint row, the Live Board group and the Session group. `DeleteAccountDialog` accepts `variant: "club" | "account"` (default `"club"`) and `needsPassword: boolean` (default `true`).

- [ ] **Step 1: Settings, add the props**

In `src/views/Settings.jsx`, change the `SettingsRow` function to accept `hidden`:

```jsx
function SettingsRow({ title, body, children, hidden }) {
  if (hidden) return null;
  return (
```

Change the component signature and the first line of its body:

```jsx
export default function Settings({
  session, onRenameClub, onNewSession, onSwitchClub, onDeleteAccount, onChangePassword, onSetPasswordHint,
  onSetDefaults, rules, onSetRules, costDefaults, onSetCostDefaults, live, onSetLive, display, onSetDisplay,
  mode = "club", canChangePassword = true,
}) {
  const isAccount = mode === "account";
  const [confirmNewLink, setConfirmNewLink] = useState(false);
```

- [ ] **Step 2: Settings, hide club-only rows**

Edit the Password row (add `hidden` and account wording):

```jsx
          <SettingsRow
            hidden={!canChangePassword}
            title="Password"
            body={isAccount
              ? "Used to sign in to your account. Can't be looked up or displayed, only changed."
              : "Used to log back into this club. Can't be looked up or displayed, only changed."}
          >
```

Edit the Password hint row opening tag:

```jsx
          <SettingsRow
            hidden={isAccount}
            title="Password hint"
```

Edit the Live Board group opening (exact old text, then new):

old:
```jsx
      <div className="account-group">
        <div className="eyebrow">Live Board</div>
```
new:
```jsx
      <div className="account-group" hidden={isAccount}>
        <div className="eyebrow">Live Board</div>
```

Edit the Session group opening:

old:
```jsx
      <div className="account-group">
        <div className="eyebrow">Session</div>
```
new:
```jsx
      <div className="account-group" hidden={isAccount}>
        <div className="eyebrow">Session</div>
```

Edit the Delete Account row body:

```jsx
          <SettingsRow
            title="Delete Account"
            body={isAccount
              ? "Permanently erases your account, roster and open plays. Cannot be undone."
              : "Permanently erases this club and everything in it. Cannot be undone."}
          >
```

(The existing `<button className="danger" onClick={onDeleteAccount}>…</button>` child stays as is.)

Append to `src/styles.css`:

```css
.account-group[hidden]{display:none}
```

- [ ] **Step 3: Delete dialog, account wording and optional password**

Replace the whole of `src/components/DeleteAccountDialog.jsx` with:

```jsx
import { useState } from "react";
import { createPortal } from "react-dom";

// onConfirm(password) resolves to "" on success or an error message to show here.
// needsPassword is false for Google-only accounts: the Google window confirms instead.
export default function DeleteAccountDialog({ clubName, loading, onCancel, onConfirm, variant = "club", needsPassword = true }) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const isAccount = variant === "account";
  const matches = typed.trim() === clubName;
  const ready = matches && (!needsPassword || password) && !loading;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setError("");
    const err = await onConfirm(password);
    if (err) setError(err);
  };

  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !loading && onCancel()}>
      <form className="modal confirm-modal" onSubmit={submit}>
        <h3>Delete {clubName}?</h3>
        <p>
          {isAccount
            ? "This permanently deletes your account, your roster and every open play, booking and cost record. There is no undo."
            : "This permanently deletes every player, court, match, and cost record for this club, and frees up the club name for anyone to use again. There is no undo."}
        </p>
        <label>
          Type <b>{clubName}</b> to confirm
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            disabled={loading}
          />
        </label>
        {needsPassword && (
          <label>
            {isAccount ? "Account password" : "Club password"}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
        )}
        {error && <p className="clublogin-error" role="alert">{error}</p>}
        <div className="modalactions">
          <button type="button" className="outline" onClick={onCancel} disabled={loading}>Cancel</button>
          <button type="submit" className="danger" disabled={!ready}>
            {loading ? "Deleting…" : "Delete Forever"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
```

- [ ] **Step 4: Wire settings and delete into `AccountApp`**

In `src/AccountApp.jsx` add imports:

```jsx
import Settings from "./views/Settings";
import DeleteAccountDialog from "./components/DeleteAccountDialog";
import { DEFAULT_COST, DEFAULT_DISPLAY, DEFAULT_LIVE, DEFAULT_RULES } from "./data/constants";
```

(replace the existing `import { DEFAULT_DISPLAY } from "./data/constants";` line with the combined import above.)

Add state next to the toast state:

```jsx
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
```

Add, after the `display` line:

```jsx
  const rules = { ...DEFAULT_RULES, ...acct.account?.rules };
  const costDefaults = { ...DEFAULT_COST, ...acct.account?.costDefaults };
  const live = { ...DEFAULT_LIVE, ...acct.account?.live };
  const save = async (patch) => { await acct.updateAccount(patch); notify("Saved."); };

  // Success signs the user out itself (deleteUser), which unmounts this page.
  const handleDelete = async (password) => {
    setDeleting(true);
    try {
      const err = await acct.deleteAccount(password);
      if (err) setDeleting(false);
      return err;
    } catch {
      setDeleting(false);
      return "Couldn't delete the account. Please try again.";
    }
  };
```

Replace the placeholder inside `<main>`:

```jsx
        {route === "settings" ? (
          <Settings
            mode="account"
            session={{ location: acct.account.clubName, defaults: acct.account.defaults }}
            canChangePassword={acct.hasPassword}
            onRenameClub={(clubName) => save({ clubName })}
            onChangePassword={acct.changePassword}
            onDeleteAccount={() => setShowDelete(true)}
            onSetDefaults={(defaults) => save({ defaults })}
            rules={rules} costDefaults={costDefaults} live={live} display={display}
            onSetRules={(change) => save({ rules: { ...rules, ...change } })}
            onSetCostDefaults={(change) => save({ costDefaults: { ...costDefaults, ...change } })}
            onSetLive={(change) => save({ live: { ...live, ...change } })}
            onSetDisplay={(change) => save({ display: { ...display, ...change } })}
          />
        ) : (
          <Hub clubName={acct.account.clubName} navigate={navigate} />
        )}
```

Add the dialog just above `<Toast … />`:

```jsx
      {showDelete && (
        <DeleteAccountDialog
          variant="account" clubName={acct.account.clubName} needsPassword={acct.hasPassword} loading={deleting}
          onCancel={() => setShowDelete(false)} onConfirm={handleDelete}
        />
      )}
```

- [ ] **Step 5: Verify in the browser**

With the dev server running, signed in as the test account, open `/settings`:
1. Groups shown: Club (name, Password; no hint row), Session defaults, Queue rules, Cost, Display, Danger Zone. Live Board and Session groups are absent.
2. Rename the club: toast "Saved.", hub title updates, Firestore `accounts/{uid}.clubName` changes.
3. Switch Theme to Dark: whole page goes dark and survives a reload with no light flash. Change the theme color: tabs and buttons recolor.
4. Change a Queue rule and the clock; reload; values persist.
5. Change password: wrong current password shows "Current password is incorrect."; correct one succeeds. Sign out and sign in with the new password.
6. Delete Account: button is disabled until the club name is typed exactly and a password entered; a wrong password shows "Password is incorrect." and the account survives; the right one signs you out, and signing in with those credentials fails. In Firebase console, `accounts/{uid}` and the Auth user are gone.
7. (Google) Sign in with Google, open Settings: no Password row. Delete Account: no password field; submitting opens the Google window; closing it shows "Confirm with Google to delete your account." and keeps the account.

Expected: all seven behave as described.

- [ ] **Step 6: Commit**

```bash
git add src/views/Settings.jsx src/components/DeleteAccountDialog.jsx src/AccountApp.jsx src/styles.css
git commit -m "feat: account settings page and account deletion" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Documentation and the full check

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Document the new structure**

In `CLAUDE.md`, add to the end of the "Already built" list (after the Open play bullets):

```md
- Accounts (step 1 of `docs/superpowers/specs/2026-10-06-accounts-and-events-design.md`): real Firebase accounts
  (email + password or Google) with a profile at `accounts/{uid}` (owner-only in `firestore.rules`). `main.jsx` picks the page
  with `routeOf` in `utils/route.js`: `/live`, `/open-play`, `/club` (the existing club app, unchanged), everything else is
  `AccountApp` (sign-in, hub, settings). Club logins (`@courtflow.local` emails) are never accounts (`isAccountUser` in
  `utils/account.js`, plus a guard in `useClub`). Account settings reuse `Settings.jsx` with `mode="account"`. Account
  delete wipes `roster` and `events` (step 2 adds each event's subcollections to the cascade in `useAccount.js`).
  Checks: `node src/utils/account.check.mjs`, `node src/utils/route.check.mjs`, `npm run test:rules` (emulator, needs Java).
```

- [ ] **Step 2: Run every check and the build**

```bash
node src/utils/account.check.mjs && node src/utils/route.check.mjs && node src/utils/bookings.check.mjs && node src/utils/theme.check.mjs && node src/utils/rotationModes.check.mjs && npm run test:rules && npx vite build
```

Expected: five `ok`/`passed` lines, `rules: all assertions passed`, and a successful build.

- [ ] **Step 3: Restore build output and commit**

`dist/` is tracked; do not commit a rebuild.

```bash
git checkout -- dist
git add CLAUDE.md
git commit -m "docs: describe accounts, routes and checks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Deploy note (do not run without approval)**

Rules must be deployed before accounts work on the live site, then hosting: `firebase deploy --only firestore:rules`, then build and `firebase deploy --only hosting`. Add the live domain to Firebase Auth authorized domains first (Before you start).

---

## Self-review

**Spec coverage (step 1 of the spec):** accounts and sign-in (email + Google, reset): Tasks 2 to 4. Hub: Task 5. Account doc and account-level settings: Tasks 3 and 6. Rules for `accounts/**` with emulator tests: Task 1. Delete account (re-auth, data first, auth last, chunked batches): Task 3 hook and Task 6 UI. Old data ignored: nothing touches `sessions/*`, `/club` keeps working. Gaps, intentional: roster/events/public pages are steps 2 to 4; the cascade list in `useAccount.js` already names `roster` and `events` so step 2 only adds each event's subcollections; the Live Board settings group is hidden until step 4 consumes it. One addition beyond the spec: `/club` keeps the existing app reachable during the transition (the spec says old data is unused, but the app stays until step 3 replaces it).

**Placeholders:** none; every code step has full code, every verification step lists exact checks.

**Type consistency:** `useAccount` action names (`signIn`, `signUp`, `signInGoogle`, `resetPassword`, `signOutUser`, `updateAccount`, `changePassword`, `deleteAccount`, `hasPassword`) match their use in `AccountApp` and `AccountLogin` (`onSignIn`, `onSignUp`, `onGoogle`, `onReset`). `signUp(clubName, email, password)` order matches the call in `AccountLogin`. `routeOf` return values match the `pages` map keys in `main.jsx` and the `route` comparisons in `AccountApp`. `Settings` props `mode` and `canChangePassword` are passed exactly so. `DeleteAccountDialog` props `variant`, `needsPassword` match.

**Review Focus coverage:** items 1 to 3 and 5 are pinned by `account.check.mjs`; item 4 by `route.check.mjs` plus Task 5 step 5; the `useClub` guard is Task 3 step 1.
