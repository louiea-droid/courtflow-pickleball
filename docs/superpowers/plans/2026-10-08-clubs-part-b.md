# Clubs, Part B: Joining, Members, Invite Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in person can find a public club and ask to join it, or join any club with an invite link. Managers approve or decline requests, remove members and manage the invite link; members see each other and can leave. Deleting a club or an account leaves no stale "My clubs" cards or ghost members.

**Architecture:** New Firestore rules let a person create a join request (`joinRequests/{uid}`) or, with the club's current invite code, their own member record; a manager approves by creating the member record and the person's "My clubs" copy in one batch (rules mirror the two writes with `getAfter` / `existsAfter`). The UI adds a Members tab, a join panel on the club page for non-members, a "Find a club" screen (public clubs loaded once and filtered on the device, so no index) and a hub entry. Pure helpers live in `utils/clubs.js` with node checks; the rules are pinned by a new emulator test file.

**Tech Stack:** React 19, Vite, Firebase Auth + Firestore, lucide-react, Firestore emulator + `@firebase/rules-unit-testing`, Playwright MCP for the browser pass.

**Spec:** `docs/superpowers/specs/2026-10-08-clubs-part-b-design.md` (builds on `2026-10-08-clubs-design.md`). Branch `feat/accounts-hub`.

## Global Constraints

- Every color is a token on `:root` in `src/styles.css` (`var(--accent)`, `var(--line)`, `var(--muted)`, `var(--danger-ink)` ...). Never raw hex. (CLAUDE.md)
- No avatar-initial badges next to names. Plain names only.
- New CSS goes in `src/clubs.css`, scoped under `.acct-shell` (or a class used only inside it). `styles.css` is not edited.
- No new dependencies, no router library. Copy: sentence case, active voice, errors say what went wrong and what to do; one name per action across screens ("Request to join", "Join club", "Leave club", "Remove", "Reset link").
- **Modules that a `*.check.mjs` or a test imports use relative imports with the `.js` extension** (`from "./clubs.js"`).
- Files may use CRLF. Multi-line edits use the `edit(file, pairs)` helper shown in each task (normalizes to LF, throws if an anchor is missing, writes the original endings back). Never use `sed` for multi-line edits.
- `dist/` is tracked: after every `npx vite build`, run `git checkout -- dist && git clean -fdq dist`; never commit a rebuild. `.playwright-mcp/` is tracked: never `rm -rf` it; clean untracked screenshots with `git clean -fdq .playwright-mcp`.
- Commit only the paths a step lists, never `git add -A`. End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never deploy, push or merge. **Publishing `firestore.rules` is the owner's step**; browser checks run on the local emulators (`npm run emulators`, `npm run dev:emu`, port 5300), which need no published rules.
- Playwright caveat: the custom Select menus close on any scroll event, so open and pick options with `page.evaluate(() => el.click())`.

## Review Focus

Conditions the spec implies but the happy path will not exercise, most likely first. Each is pinned by a named test or step.

1. **Forging a membership.** Writing someone else's member record or "My clubs" copy, claiming a higher role, joining with an old or missing code, requesting a private club, requesting while already a member, approving without a pending (or with a declined) request, a manager touching the owner or another manager, a plain member removing anyone. Pinned by `tests/membership.test.mjs` (Task 2) for a signed-out visitor, an anonymous quick-session user, a legacy login, a stranger, the requester, a member, a manager and the owner on a public and a private club.
2. **Nothing stale left behind.** Deleting a club removes every member's "My clubs" copy; deleting an account as a plain member leaves the club first; a stale card (removed member, deleted club) cleans itself up. Pinned by `tests/cascade.test.mjs` (Task 3) and browser steps 5 and 6 (Task 6).
3. **A reset or old invite code** fails with a clear message, never a crash or a silent no-op; a wrong code never reveals the invite document. Pinned by the rules test (Task 2) and browser step 3 (Task 6).
4. **A non-member on a private club** sees only its name and description, with no tabs, no "No open play" line and no permission-denied noise. Browser step 4 (Task 6).
5. **Double actions and races:** approving a person who already joined by invite (the batch is refused; the request must just be cleared), double-clicking Approve or Join, withdrawing while a manager approves. Handled in `useMembershipActions` and the `busy` flags (Task 4); browser step 2 (Task 6).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/clubs.js`, `clubs.check.mjs` (modify) | Invite codes and URLs, join request and member records, directory filter. |
| `src/utils/route.js`, `route.check.mjs` (modify) | `/clubs/find` and `/clubs/:id/members`. |
| `firestore.rules` (modify), `tests/rules.test.mjs` (modify), `tests/membership.test.mjs` (new), `package.json` (modify) | Join request, invite join, approval, leave and remove rules and their matrix. |
| `src/utils/accountData.js` (modify), `tests/cascade.test.mjs` (modify) | Club delete removes other members' copies; account delete leaves clubs first. |
| `src/hooks/useMembership.js`, `src/hooks/useMembershipActions.js` (new) | Directory, members, join requests, own request, invite listeners; all membership writes. |
| `src/views/FindClubs.jsx`, `ClubMembers.jsx`, `src/components/JoinPanel.jsx` (new) | Screens. |
| `src/ClubApp.jsx`, `src/AccountApp.jsx`, `src/views/Hub.jsx`, `src/components/ShareModal.jsx` (modify) | Members tab, join panel, routing, hub entry, invite share label. |
| `src/clubs.css` (modify) | Styles for the new screens. |
| `CLAUDE.md`, `docs/superpowers/specs/2026-10-08-clubs-design.md` (modify) | Document part B; correct the index claim. |

## Before you start

- [ ] Branch `feat/accounts-hub`, `git status --short` clean. `npm run test:rules` prints `rules: all assertions passed` and `cascade: ok`.
- [ ] Spec deviations decided in this plan (ledger them if you re-check): the directory rows show only a "Member" pill (the request state is shown on the club page, which avoids one read per club); a stale "My clubs" card is removed automatically after a short check instead of by a button.

---

### Task 1: Pure helpers and routes

**Files:**
- Modify: `src/utils/clubs.js`, `src/utils/clubs.check.mjs`, `src/utils/route.js`, `src/utils/route.check.mjs`

**Interfaces:**
- Produces: `newInviteCode(): string` (8 characters from `A-HJ-NP-Z2-9`), `inviteUrl(origin, clubId, code): string`, `JOIN_MESSAGE_MAX = 200`, `validateJoinMessage(message): string` (empty = fine), `joinRequestDoc(name, message, now)`, `memberRecord(name, now, inviteCode?)`, `filterClubs(clubs, search)`; `routeOf` returns `clubs-find` and `club-members`; `clubIdOf("/clubs/find")` is `null`.

- [ ] **Step 1: Write the failing checks**

In `src/utils/clubs.check.mjs` change the import line to
`import { ROLE_LABEL, clubPath, filterClubs, inviteUrl, joinRequestDoc, memberRecord, membershipCopy, newClubDoc, newInviteCode, permissions, validateClubInput, validateJoinMessage } from "./clubs.js";`
and add before the final `console.log`:

```js
// Part B: invite codes are 8 characters without look-alikes (no I, O, 0, 1) and differ every time.
const code = newInviteCode();
assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
assert.notEqual(code, newInviteCode());
assert.equal(inviteUrl("https://x.test", "abc", "K7M2QXWA"), "https://x.test/clubs/abc?invite=K7M2QXWA");
assert.equal(inviteUrl("https://x.test", "a b", "c/d"), "https://x.test/clubs/a%20b?invite=c%2Fd");

// Join messages are optional, up to 200 characters.
assert.equal(validateJoinMessage(""), "");
assert.equal(validateJoinMessage("x".repeat(200)), "");
assert.match(validateJoinMessage("x".repeat(201)), /200/);

// The request and member documents the rules accept: trimmed, names capped at 60, no empty message stored.
assert.deepEqual(joinRequestDoc("  Sam  ", "  hi  ", 7), { name: "Sam", message: "hi", status: "pending", createdAt: 7 });
assert.deepEqual(joinRequestDoc("Sam", "   ", 7), { name: "Sam", status: "pending", createdAt: 7 });
assert.equal(joinRequestDoc("x".repeat(80), "", 1).name.length, 60);
assert.equal(joinRequestDoc("  ", "", 1).name, "Member");
assert.deepEqual(memberRecord("Sam", 5), { role: "member", name: "Sam", joinedAt: 5 });
assert.deepEqual(memberRecord("Sam", 5, "K7M2QXWA"), { role: "member", name: "Sam", joinedAt: 5, inviteCode: "K7M2QXWA" });
assert.equal(memberRecord("", 5).name, "Member");

// Directory search: by name or place, case-insensitive, contains; the list is sorted by name.
const clubs = [
  { id: "1", name: "Centro Pickle", location: "Manila" },
  { id: "2", name: "Aces", location: "Cebu City" },
  { id: "3", name: "bay smash", location: "Davao" },
];
assert.deepEqual(filterClubs(clubs, "").map((c) => c.id), ["2", "3", "1"]);
assert.deepEqual(filterClubs(clubs, "PICK").map((c) => c.id), ["1"]);
assert.deepEqual(filterClubs(clubs, " cebu ").map((c) => c.id), ["2"]);
assert.deepEqual(filterClubs(clubs, "zzz"), []);
assert.deepEqual(filterClubs([{ id: "9" }], "a"), []); // a club without a name never matches or crashes
```

In `src/utils/route.check.mjs` add before the final `console.log`:

```js
// Part B routes. "find" is not a club id.
assert.equal(routeOf("/clubs/find"), "clubs-find");
assert.equal(routeOf("/clubs/find/"), "clubs-find");
assert.equal(routeOf("/clubs/abc/members"), "club-members");
assert.equal(routeOf("/clubs/abc/members/"), "club-members");
assert.equal(routeOf("/clubs/abc/members/x"), "hub");
assert.equal(clubIdOf("/clubs/find"), null);
assert.equal(clubIdOf("/clubs/abc/members"), "abc");
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node src/utils/clubs.check.mjs; node src/utils/route.check.mjs`
Expected: `clubs.check` FAILS with `SyntaxError ... does not provide an export named 'filterClubs'` (or another new name); `route.check` FAILS with an `AssertionError` on `clubs-find`.

- [ ] **Step 3: Implement**

Append to `src/utils/clubs.js`:

```js

// ---- Part B: joining ----
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 characters, so a byte maps evenly; no I, O, 0, 1

// A new invite code. Resetting the link stores a new one, which stops every old link.
export function newInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export const inviteUrl = (origin, clubId, code) => `${origin}${clubPath(clubId)}?invite=${encodeURIComponent(code)}`;

export const JOIN_MESSAGE_MAX = 200;
export const validateJoinMessage = (message = "") =>
  (message.trim().length > JOIN_MESSAGE_MAX ? `The message can be up to ${JOIN_MESSAGE_MAX} characters.` : "");

const personName = (name) => (name || "").trim().slice(0, 60) || "Member";

// The documents the rules accept (see firestore.rules): a pending request, and a plain member record.
export function joinRequestDoc(name, message, now) {
  const text = (message || "").trim();
  return { name: personName(name), ...(text ? { message: text } : {}), status: "pending", createdAt: now };
}
export const memberRecord = (name, now, inviteCode) => ({
  role: "member", name: personName(name), joinedAt: now, ...(inviteCode ? { inviteCode } : {}),
});

// Directory search: runs on the device over the public clubs already loaded.
export function filterClubs(clubs, search = "") {
  const q = search.trim().toLowerCase();
  const sorted = [...clubs].sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));
  if (!q) return sorted;
  return sorted.filter((c) => `${c.name || ""} ${c.location || ""}`.toLowerCase().includes(q));
}
```

In `src/utils/route.js` apply these exact replacements (a small `.cjs` script with the `edit` helper, or the Edit tool):
- `  if (path === "/clubs/new") return "clubs-new";` → `  if (path === "/clubs/new") return "clubs-new";\n  if (path === "/clubs/find") return "clubs-find";`
- `    if (rest === "/settings") return "club-settings";` → `    if (rest === "/settings") return "club-settings";\n    if (rest === "/members") return "club-members";`
- `return m && m[1] !== "new" ? decodeURIComponent(m[1]) : null;` → `return m && !["new", "find"].includes(m[1]) ? decodeURIComponent(m[1]) : null;`
- the comment above `clubIdOf`: `"/clubs/new" is not a club.` → `"/clubs/new" and "/clubs/find" are not clubs.`

- [ ] **Step 4: Run them to verify they pass**

Run: `node src/utils/clubs.check.mjs && node src/utils/route.check.mjs`
Expected: `clubs.check: ok`, `route.check: ok`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/clubs.js src/utils/clubs.check.mjs src/utils/route.js src/utils/route.check.mjs
git commit -m "feat: invite codes, join records, directory filter and the find/members routes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Rules and the membership matrix

**Files:**
- Modify: `firestore.rules`, `tests/rules.test.mjs`, `package.json`
- Create: `tests/membership.test.mjs`

**Interfaces:**
- Consumes: Task 1 record shapes (`joinRequestDoc`, `memberRecord`, `membershipCopy`).
- Produces: the rules in the spec (Rules section).

- [ ] **Step 1: Write the failing test file**

Create `tests/membership.test.mjs`:

```js
// Firestore rules for joining: requests, invite joins, approval, leaving, removing.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const rules = fs.readFileSync("firestore.rules", "utf8");
const env = await initializeTestEnvironment({ projectId: "membership-test", firestore: { rules, host: "127.0.0.1", port: 8080 } });

const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anon = env.unauthenticatedContext().firestore();
const quick = env.authenticatedContext("q1", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const legacy = env.authenticatedContext("c1", { email: "club1@courtflow.local", firebase: { sign_in_provider: "password" } }).firestore();
const own = real("own"), mgr = real("mgr"), mem = real("mem"), mem2 = real("mem2"), req = real("req"), req2 = real("req2"), other = real("other");
const now = () => Date.now();

// A public club "pub" and a private club "priv": an owner, two managers, two members, an invite code and the
// members' "My clubs" copies. "noinv" is a public club that never created an invite link.
async function seed() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const id of ["pub", "priv"]) {
      await setDoc(doc(db, `clubs/${id}`), { name: id, nameLower: id, visibility: id === "pub" ? "public" : "private", ownerId: "own", createdAt: 1 });
      const people = { own: "owner", mgr: "manager", mgr2: "manager", mem: "member", mem2: "member" };
      for (const [uid, role] of Object.entries(people)) {
        await setDoc(doc(db, `clubs/${id}/members/${uid}`), { role, name: uid, joinedAt: 1 });
        await setDoc(doc(db, `accounts/${uid}/memberships/${id}`), { clubName: id, role, joinedAt: 1 });
      }
      await setDoc(doc(db, `clubs/${id}/private/invite`), { code: "GOODCODE" });
    }
    await setDoc(doc(db, "clubs/noinv"), { name: "noinv", nameLower: "noinv", visibility: "public", ownerId: "own", createdAt: 1 });
    await setDoc(doc(db, "clubs/noinv/members/own"), { role: "owner", name: "own", joinedAt: 1 });
  });
}
const putRequest = (club, uid, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), `clubs/${club}/joinRequests/${uid}`), data));
const jr = (db, club, uid) => doc(db, `clubs/${club}/joinRequests/${uid}`);
const reqDoc = (extra = {}) => ({ name: "Rae", status: "pending", createdAt: now(), ...extra });
const copyDoc = (club) => ({ clubName: club, role: "member", joinedAt: now() });

// ---- Join requests
await seed();
await assertSucceeds(setDoc(jr(req, "pub", "req"), reqDoc({ message: "Hi, I play Saturdays" })));
await assertFails(setDoc(jr(req, "pub", "req"), reqDoc())); // a second request is an update
await assertFails(setDoc(jr(req2, "priv", "req2"), reqDoc())); // private clubs take no requests
await assertFails(setDoc(jr(req2, "pub", "req"), reqDoc())); // someone else's id
await assertFails(setDoc(jr(anon, "pub", "req2"), reqDoc()));
await assertFails(setDoc(jr(quick, "pub", "q1"), reqDoc())); // Review Focus 1: anonymous quick-session user
await assertFails(setDoc(jr(legacy, "pub", "c1"), reqDoc())); // old club login
await assertFails(setDoc(jr(mem, "pub", "mem"), reqDoc())); // already a member
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ extra: 1 })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ status: "approved" })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ name: "" })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ name: "x".repeat(61) })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ message: "x".repeat(201) })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ createdAt: 0 })));
await assertFails(setDoc(jr(req2, "pub", "req2"), reqDoc({ createdAt: now() + 86400000 })));
await assertFails(setDoc(jr(req2, "nope", "req2"), reqDoc())); // no such club
// reads
await assertSucceeds(getDoc(jr(req, "pub", "req")));
await assertSucceeds(getDoc(jr(req2, "pub", "req2"))); // your own, even when there is none
await assertFails(getDoc(jr(other, "pub", "req")));
await assertFails(getDoc(jr(mem, "pub", "req")));
await assertFails(getDoc(jr(anon, "pub", "req")));
await assertSucceeds(getDoc(jr(mgr, "pub", "req")));
await assertSucceeds(getDoc(jr(own, "pub", "req")));
await assertSucceeds(getDocs(collection(mgr, "clubs/pub/joinRequests")));
await assertFails(getDocs(collection(mem, "clubs/pub/joinRequests")));
await assertFails(getDocs(collection(req, "clubs/pub/joinRequests")));
// updates: only a manager, only to declined
await assertFails(updateDoc(jr(mgr, "pub", "req"), { status: "approved" }));
await assertFails(updateDoc(jr(mgr, "pub", "req"), { name: "Other" }));
await assertFails(updateDoc(jr(mgr, "pub", "req"), { status: "declined", name: "Other" }));
await assertFails(updateDoc(jr(req, "pub", "req"), { status: "declined" }));
await assertFails(updateDoc(jr(mem, "pub", "req"), { status: "declined" }));
await assertSucceeds(updateDoc(jr(own, "pub", "req"), { status: "declined" }));
// deletes: the requester (withdraw, dismiss) or a manager
await assertFails(deleteDoc(jr(other, "pub", "req")));
await assertFails(deleteDoc(jr(mem, "pub", "req")));
await assertSucceeds(deleteDoc(jr(req, "pub", "req")));
await putRequest("pub", "req", reqDoc());
await assertSucceeds(deleteDoc(jr(mgr, "pub", "req")));

// ---- Joining with the invite link: the member record carries the code, plus the person's own card
await seed();
const memberDoc = (extra = {}) => ({ role: "member", name: "Rae", joinedAt: now(), inviteCode: "GOODCODE", ...extra });
const join = (db, club, uid, data, copy = copyDoc(club)) => {
  const b = writeBatch(db);
  b.set(doc(db, `clubs/${club}/members/${uid}`), data);
  b.set(doc(db, `accounts/${uid}/memberships/${club}`), copy);
  return b.commit();
};
const { inviteCode: _code, ...noCode } = memberDoc();
await assertFails(join(other, "pub", "other", memberDoc({ inviteCode: "OLDCODE" }))); // Review Focus 3: wrong code
await assertFails(join(other, "pub", "other", noCode));
await assertFails(join(other, "pub", "other", memberDoc({ role: "manager" }))); // Review Focus 1: higher role
await assertFails(join(other, "pub", "other", memberDoc({ role: "owner" })));
await assertFails(join(other, "pub", "other", memberDoc({ extra: 1 })));
await assertFails(join(other, "pub", "other", memberDoc({ name: "" })));
await assertFails(join(other, "pub", "other", memberDoc({ joinedAt: 0 })));
await assertFails(join(other, "pub", "req", memberDoc())); // someone else's record
await assertFails(join(anon, "pub", "x", memberDoc()));
await assertFails(join(quick, "pub", "q1", memberDoc()));
await assertFails(join(legacy, "pub", "c1", memberDoc()));
await assertFails(join(mem, "pub", "mem", memberDoc())); // already a member: re-creating is an update
await assertFails(join(other, "noinv", "other", memberDoc())); // a club that never made an invite link
await assertSucceeds(join(req, "pub", "req", memberDoc()));
await assertSucceeds(join(req2, "priv", "req2", memberDoc())); // private clubs are joined this way
await assertSucceeds(getDoc(doc(req, "clubs/pub/members/mem"))); // now a member: can read the list
await assertFails(getDoc(doc(req, "clubs/pub/private/invite"))); // but the invite document stays managers-only
await assertFails(getDoc(doc(other, "clubs/pub/private/invite")));
await assertFails(getDoc(doc(mem, "clubs/pub/private/invite")));
// reset: a manager replaces the code; the old one stops working at once
await assertSucceeds(setDoc(doc(mgr, "clubs/pub/private/invite"), { code: "NEWCODE2" }));
await assertFails(setDoc(doc(mem, "clubs/pub/private/invite"), { code: "MEMCODE1" }));
await assertFails(join(other, "pub", "other", memberDoc())); // GOODCODE is old now
await assertSucceeds(join(other, "pub", "other", memberDoc({ inviteCode: "NEWCODE2" })));

// ---- Approval: member record + the person's card + the request, in one batch, by a manager
await seed();
await putRequest("pub", "req", reqDoc());
const approvedMember = (extra = {}) => ({ role: "member", name: "Rae", joinedAt: now(), ...extra });
const approve = (db, club, uid, member = approvedMember(), copy = copyDoc(club)) => {
  const b = writeBatch(db);
  b.set(doc(db, `clubs/${club}/members/${uid}`), member);
  b.set(doc(db, `accounts/${uid}/memberships/${club}`), copy);
  b.delete(jr(db, club, uid));
  return b.commit();
};
await assertFails(approve(mem, "pub", "req")); // a plain member
await assertFails(approve(other, "pub", "req")); // a stranger
await assertFails(approve(mgr, "pub", "req", approvedMember({ role: "manager" })));
await assertFails(approve(mgr, "pub", "req", approvedMember({ role: "owner" })));
await assertFails(approve(mgr, "pub", "req", approvedMember({ inviteCode: "GOODCODE" }))); // approval never carries a code
await assertFails(approve(mgr, "pub", "req", approvedMember(), { clubName: "pub", role: "owner", joinedAt: 1 })); // card claiming owner
await assertFails(approve(mgr, "pub", "nobody")); // no request from that person
await putRequest("pub", "req2", reqDoc({ status: "declined" }));
await assertFails(approve(mgr, "pub", "req2")); // a declined request is not approvable
await assertFails(setDoc(doc(mgr, "accounts/req/memberships/pub"), copyDoc("pub"))); // a card with no member record
await assertFails(setDoc(doc(mgr, "accounts/req"), { name: "x" })); // nothing else of theirs
await assertSucceeds(approve(mgr, "pub", "req"));
await putRequest("pub", "other", reqDoc());
await assertSucceeds(approve(own, "pub", "other"));

// ---- Leaving and removing
await seed();
const drop = (db, club, uid) => {
  const b = writeBatch(db);
  b.delete(doc(db, `clubs/${club}/members/${uid}`));
  b.delete(doc(db, `accounts/${uid}/memberships/${club}`));
  return b.commit();
};
await assertFails(drop(mem, "pub", "mem2")); // a member removing a member
await assertFails(drop(mem, "pub", "mgr"));
await assertFails(drop(mgr, "pub", "own")); // a manager removing the owner
await assertFails(drop(mgr, "pub", "mgr2")); // a manager removing another manager
await assertFails(drop(own, "pub", "own")); // the owner can't leave a club that still exists
await assertFails(deleteDoc(doc(mgr, "accounts/mem2/memberships/pub"))); // a card alone, while still a member
await assertFails(deleteDoc(doc(mem2, "accounts/mem/memberships/pub")));
await assertFails(deleteDoc(doc(mgr, "accounts/own/memberships/pub"))); // never the owner's card
await assertSucceeds(drop(mgr, "pub", "mem")); // a manager removes a plain member and the card
await assertSucceeds(drop(mem2, "pub", "mem2")); // a member leaves
await assertSucceeds(drop(own, "pub", "mgr2")); // the owner removes a manager
await assertSucceeds(drop(mgr, "priv", "mem")); // the same on a private club
await assertFails(getDoc(doc(real("mem"), "clubs/priv/events/e1"))); // a removed member is a stranger again (no event, no error)

console.log("membership: all assertions passed");
await env.cleanup();
```

Wire it into the test script: in `package.json` change the `test:rules` script to end with `... node tests/rules.test.mjs && node tests/cascade.test.mjs && node tests/membership.test.mjs\"` (same `firebase emulators:exec --only firestore --project rules-test` prefix).

In `tests/rules.test.mjs` replace the one assertion that Part B reverses:
`await assertFails(deleteDoc(doc(mgr, "clubs/pub/members/mem")));` → `await assertFails(deleteDoc(doc(mem, "clubs/pub/members/mgr"))); // a member can't remove a manager (managers removing plain members is tested in membership.test.mjs)`

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:rules`
Expected: `rules.test.mjs` prints `rules: all assertions passed` (the old rules still satisfy the edited line), `cascade: ok`, then `membership.test.mjs` FAILS on the first `assertSucceeds` (a request is refused: the old rules only let managers write `joinRequests`).

- [ ] **Step 3: Write the rules**

Write `ui-rules.cjs` in the scratchpad (the `edit` helper from Global Constraints) and run it from the repo root:

```js
const fs = require("fs");
function edit(f, pairs) {
  let s = fs.readFileSync(f, "utf8");
  const crlf = s.includes("\r\n");
  s = s.split("\r\n").join("\n");
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(f + " missing: " + a.slice(0, 80));
    s = s.split(a).join(b);
  }
  fs.writeFileSync(f, crlf ? s.split("\n").join("\r\n") : s);
}
edit("firestore.rules", [
  // 1. A manager mirrors a member-record change on that person's "My clubs" card, in the same batch.
  ["    // ---- Clubs. The member record is the single source of truth for who may do what.\n",
`    // A manager may create a new member's card when approving them, and delete a card when removing the
    // member, only in the same batch as the member-record change (getAfter / existsAfter). Nothing else
    // of another person's account is reachable. (Everything of your own is covered by the rule above.)
    match /accounts/{uid}/memberships/{clubId} {
      allow create: if isManager(clubId)
        && request.resource.data.role == 'member'
        && request.resource.data.keys().hasOnly(['clubName', 'role', 'joinedAt'])
        && getAfter(/databases/$(database)/documents/clubs/$(clubId)/members/$(uid)).data.role == 'member';
      allow delete: if isManager(clubId)
        && uid != get(clubPath(clubId)).data.ownerId
        && !existsAfter(/databases/$(database)/documents/clubs/$(clubId)/members/$(uid));
    }

    // ---- Clubs. The member record is the single source of truth for who may do what.
`],
  // 2. Helpers for joining.
  ["    function validClub(d) {",
`    function invitePath(clubId) {
      return /databases/$(database)/documents/clubs/$(clubId)/private/invite;
    }
    function joinRequestPath(clubId, uid) {
      return /databases/$(database)/documents/clubs/$(clubId)/joinRequests/$(uid);
    }
    function nearNow(ms) {
      return ms is number && ms > request.time.toMillis() - 600000 && ms < request.time.toMillis() + 600000;
    }
    function validName(n) {
      return n is string && n.size() > 0 && n.size() <= 60;
    }

    // A person asks to join a public club (they are not signed in as a quick session, and are not a member yet).
    function validJoinRequest(clubId) {
      let d = request.resource.data;
      return d.keys().hasOnly(['name', 'message', 'status', 'createdAt'])
        && d.keys().hasAll(['name', 'status', 'createdAt'])
        && validName(d.name)
        && (!('message' in d) || (d.message is string && d.message.size() <= 200))
        && d.status == 'pending'
        && nearNow(d.createdAt)
        && isPublicClub(clubId)
        && !exists(memberPath(clubId));
    }
    // Joining with the club's current invite code. The rules read the invite document even though the
    // person cannot; resetting the code (a manager) stops every old link at once.
    function validInviteJoin(clubId, uid) {
      let d = request.resource.data;
      return request.auth.uid == uid
        && d.keys().hasOnly(['role', 'name', 'joinedAt', 'inviteCode'])
        && d.keys().hasAll(['role', 'name', 'joinedAt', 'inviteCode'])
        && d.role == 'member'
        && validName(d.name)
        && nearNow(d.joinedAt)
        && exists(invitePath(clubId))
        && d.inviteCode == get(invitePath(clubId)).data.code;
    }
    // A manager approving a pending request: a plain member record, nothing else.
    function validApproval(clubId, uid) {
      let d = request.resource.data;
      return isManager(clubId)
        && d.keys().hasOnly(['role', 'name', 'joinedAt'])
        && d.keys().hasAll(['role', 'name', 'joinedAt'])
        && d.role == 'member'
        && validName(d.name)
        && d.joinedAt is number
        && exists(joinRequestPath(clubId, uid))
        && get(joinRequestPath(clubId, uid)).data.status == 'pending';
    }

    function validClub(d) {`],
  // 3. Member records: three ways in, four ways out.
  [`        // The owner's record, created in the same batch as the club (getAfter sees the new club).
        allow create: if isRealUser() && request.auth.uid == uid
          && request.resource.data.role == 'owner'
          && request.resource.data.keys().hasOnly(['role', 'name', 'joinedAt'])
          && getAfter(clubPath(clubId)).data.ownerId == request.auth.uid;
        // The owner removes other people's records; their own record only once the club is gone.
        allow delete: if (isOwner(clubId) && request.auth.uid != uid)
          || (isRealUser() && request.auth.uid == uid && !exists(clubPath(clubId)));`,
`        // Three ways in: the owner's record (same batch as the club, getAfter sees the new club), an invite
        // join with the current code, and a manager approving a pending request.
        allow create: if isRealUser() && (
          (request.auth.uid == uid
            && request.resource.data.role == 'owner'
            && request.resource.data.keys().hasOnly(['role', 'name', 'joinedAt'])
            && getAfter(clubPath(clubId)).data.ownerId == request.auth.uid)
          || validInviteJoin(clubId, uid)
          || validApproval(clubId, uid));
        // Four ways out: the owner removes anyone else, a manager removes plain members, a member
        // leaves (the owner can't), and anyone's own record once the club is gone.
        allow delete: if isRealUser() && (
          (isOwner(clubId) && request.auth.uid != uid)
          || (isManager(clubId) && request.auth.uid != uid && resource.data.role == 'member')
          || (request.auth.uid == uid && resource.data.role != 'owner')
          || (request.auth.uid == uid && !exists(clubPath(clubId))));`],
  // 4. Join requests.
  [`      match /joinRequests/{id} {
        allow read, write: if isManager(clubId);
      }`,
`      // One request per person per club (the id is their uid). The requester sees only their own;
      // managers see all, decline (status only) and clear them. The requester withdraws or dismisses.
      match /joinRequests/{reqUid} {
        allow get: if isRealUser() && (request.auth.uid == reqUid || isManager(clubId));
        allow list: if isManager(clubId);
        allow create: if isRealUser() && request.auth.uid == reqUid && validJoinRequest(clubId);
        allow update: if isManager(clubId)
          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
          && request.resource.data.status == 'declined';
        allow delete: if isRealUser() && (request.auth.uid == reqUid || isManager(clubId));
      }`],
]);
console.log("rules updated");
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:rules`
Expected: `rules: all assertions passed`, `cascade: ok`, `membership: all assertions passed`. If `membership` fails, read the failing line: a wrong rule means fix the rule; a wrong expectation means fix the test only if the spec says so. Never loosen an assertion to make it pass. (`cascade` is expected to still pass here; Task 3 changes it.)

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/rules.test.mjs tests/membership.test.mjs package.json
git commit -m "feat: rules for join requests, invite joins, approval, leaving and removing members" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Delete cascades with members

**Files:**
- Modify: `src/utils/accountData.js`, `tests/cascade.test.mjs`

**Interfaces:**
- Consumes: Task 2 rules (the owner deletes other members' cards in the same batch as their records).
- Produces: `leaveClub(db, clubId, uid)`; `deleteClubData` also deletes every other member's card; `deleteAccountData` leaves clubs the person only belongs to first.

- [ ] **Step 1: Write the failing test**

In `tests/cascade.test.mjs`:

1. In `seedClub`, after the line that creates `clubs/${id}/members/helper`, add:
`  await setDoc(doc(db, \`accounts/helper/memberships/${id}\`), { clubName: id, role: "member", joinedAt: 1 });`
2. Right after `await deleteClubData(real("u3"), "c3", "u3");` add:
`assert.equal(await count("accounts/helper/memberships"), 2, "helper's c3 card left behind"); // c1 and c2 remain`
3. Right after the block that ends with `assert.equal(await count("accounts/u1/events"), 0);` (the account-delete assertions), add:
`assert.equal(await count("accounts/helper/memberships"), 1, "helper's c1 card left behind"); // only c2 remains`
4. Before the final `console.log("cascade: ok");` add:

```js
// A plain member who deletes their account leaves the club first (no ghost member), even when their
// record or the club's other data is already gone.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "accounts/u7"), { name: "Seven" });
  await setDoc(doc(db, "accounts/u7/memberships/c2"), { clubName: "c2", role: "member", joinedAt: 1 });
  await setDoc(doc(db, "clubs/c2/members/u7"), { role: "member", name: "Seven", joinedAt: 1 });
  await setDoc(doc(db, "accounts/u8"), { name: "Eight" });
  await setDoc(doc(db, "accounts/u8/memberships/c2"), { clubName: "c2", role: "member", joinedAt: 1 }); // no record: was removed
});
assert.equal(await count("clubs/c2/members"), 3);
await deleteAccountData(real("u7"), "u7");
assert.equal(await count("clubs/c2/members"), 2, "u7 is still listed as a member after deleting their account");
assert.equal(await count("accounts/u7/memberships"), 0);
await deleteAccountData(real("u8"), "u8"); // used to be impossible to reason about: a card with no record
assert.equal(await count("accounts/u8/memberships"), 0);
```

Run: `npm run test:rules`
Expected: `rules` and `membership` pass; `cascade` FAILS on `helper's c3 card left behind` (an `AssertionError`).

- [ ] **Step 2: Implement**

Write `ui-cascade.cjs` in the scratchpad (the same `edit` helper) and run it:

```js
edit("src/utils/accountData.js", [
  [`  const others = writeBatch(db);
  members.docs.filter((m) => m.id !== ownerId).forEach((m) => others.delete(m.ref));
  await others.commit();`,
`  const others = writeBatch(db);
  // ponytail: one batch holds 500 writes, so about 250 members; chunk it if a club grows past that.
  members.docs.filter((m) => m.id !== ownerId).forEach((m) => {
    others.delete(m.ref);
    others.delete(doc(db, "accounts", m.id, "memberships", clubId)); // their "My clubs" card goes with the club
  });
  await others.commit();`],
  [`// Events and roster that older versions kept directly under an account.`,
`// Leaves a club the person only belongs to: their member record, then their "My clubs" card. Safe to
// run when the record was already removed or the club is gone.
export async function leaveClub(db, clubId, uid) {
  const ref = doc(db, "clubs", clubId, "members", uid);
  try {
    if ((await getDoc(ref)).exists()) await deleteDoc(ref);
  } catch { /* the club is gone or the record was removed: nothing left to leave */ }
  await deleteDoc(doc(db, "accounts", uid, "memberships", clubId));
}

// Events and roster that older versions kept directly under an account.`],
  [`// copies, any data from before clubs, and the account doc itself. Data first; the caller deletes
// the sign-in last. Clubs the person only belongs to are left as they are (a later part adds leaving).`,
`// copies, any data from before clubs, and the account doc itself. Data first; the caller deletes
// the sign-in last. Clubs the person only belongs to are left first (no ghost member stays behind).`],
  [`  await Promise.all(owned.map((m) => deleteClubData(db, m.id, uid)));`,
`  const joined = memberships.docs.filter((m) => m.data().role !== "owner");
  await Promise.all(owned.map((m) => deleteClubData(db, m.id, uid)));
  await Promise.all(joined.map((m) => leaveClub(db, m.id, uid)));`],
]);
```

Run: `npm run test:rules`
Expected: `rules: all assertions passed`, `cascade: ok`, `membership: all assertions passed`.

- [ ] **Step 3: Commit**

```bash
git add src/utils/accountData.js tests/cascade.test.mjs
git commit -m "feat: deleting a club removes every member's card; deleting an account leaves its clubs first" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Hooks and actions

**Files:**
- Create: `src/hooks/useMembership.js`, `src/hooks/useMembershipActions.js`

**Interfaces:**
- Consumes: Task 1 (`joinRequestDoc`, `memberRecord`, `membershipCopy`, `newInviteCode`), Task 3 (`leaveClub`).
- Produces:
  - `useDirectory(): { clubs, ready, error }` (up to 200 public clubs).
  - `useMembers(clubId): { members: [{ id, role, name, joinedAt }], ready }` (owner, managers, then members by name; pass `null` to load nothing).
  - `useJoinRequests(clubId): { requests: [{ id, name, message?, createdAt }], ready }` (pending only, oldest first).
  - `useMyJoinRequest(uid, clubId): { request: { id, status, ... } | null, ready }`.
  - `useInvite(clubId): { code: string | null, ready }`.
  - `useMembershipActions({ uid, name, clubId, club })` returns `{ requestToJoin(message), cancelRequest(), joinWithInvite(code), approve(request), decline(request), leave(), removeMember(member), saveInvite() }`; every function rejects on failure (callers show the message). `removeMyCopy(uid, clubId)` is a separate export.

No unit test: Firestore wiring, covered by Tasks 2 and 3 and the browser steps in Task 6.

- [ ] **Step 1: The listeners**

Create `src/hooks/useMembership.js`:

```js
import { useEffect, useState } from "react";
import { collection, doc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

const RANK = { owner: 0, manager: 1, member: 2 };

// Public clubs for the directory, loaded once (up to 200) and filtered on the device. The rules only
// allow listing public clubs, so the query says so. ponytail: past 200 public clubs the search can miss
// some; the upgrade is a composite index (visibility + nameLower) and a prefix query.
export function useDirectory() {
  const [state, setState] = useState({ clubs: [], ready: false, error: false });
  useEffect(() => {
    let alive = true;
    if (!firebaseConfigured) return;
    getDocs(query(collection(db, "clubs"), where("visibility", "==", "public"), limit(200))).then(
      (s) => alive && setState({ clubs: s.docs.map((d) => ({ id: d.id, ...d.data() })), ready: true, error: false }),
      () => alive && setState({ clubs: [], ready: true, error: true }),
    );
    return () => { alive = false; };
  }, []);
  return state;
}

// Everyone in a club: the owner, then managers, then members by name. Only members can read this.
export function useMembers(clubId) {
  const [state, setState] = useState({ members: [], ready: false });
  useEffect(() => {
    setState({ members: [], ready: false });
    if (!firebaseConfigured || !clubId) return;
    return onSnapshot(
      collection(db, "clubs", clubId, "members"),
      (s) => setState({
        members: s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (RANK[a.role] ?? 9) - (RANK[b.role] ?? 9) || (a.name || "").localeCompare(b.name || "")),
        ready: true,
      }),
      () => setState({ members: [], ready: true }),
    );
  }, [clubId]);
  return state;
}

// Pending join requests, oldest first. Managers only (pass null for everyone else).
export function useJoinRequests(clubId) {
  const [state, setState] = useState({ requests: [], ready: false });
  useEffect(() => {
    setState({ requests: [], ready: false });
    if (!firebaseConfigured || !clubId) return;
    return onSnapshot(
      query(collection(db, "clubs", clubId, "joinRequests"), where("status", "==", "pending")),
      (s) => setState({
        requests: s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
        ready: true,
      }),
      () => setState({ requests: [], ready: true }),
    );
  }, [clubId]);
  return state;
}

// This person's own request to the club (pending or declined), or null.
export function useMyJoinRequest(uid, clubId) {
  const [state, setState] = useState({ request: null, ready: false });
  useEffect(() => {
    setState({ request: null, ready: false });
    if (!firebaseConfigured || !uid || !clubId) return;
    return onSnapshot(
      doc(db, "clubs", clubId, "joinRequests", uid),
      (s) => setState({ request: s.exists() ? { id: s.id, ...s.data() } : null, ready: true }),
      () => setState({ request: null, ready: true }),
    );
  }, [uid, clubId]);
  return state;
}

// The club's current invite code, or null when no link was made yet. Managers only.
export function useInvite(clubId) {
  const [state, setState] = useState({ code: null, ready: false });
  useEffect(() => {
    setState({ code: null, ready: false });
    if (!firebaseConfigured || !clubId) return;
    return onSnapshot(
      doc(db, "clubs", clubId, "private", "invite"),
      (s) => setState({ code: s.exists() ? s.data().code : null, ready: true }),
      () => setState({ code: null, ready: true }),
    );
  }, [clubId]);
  return state;
}
```

- [ ] **Step 2: The writes**

Create `src/hooks/useMembershipActions.js`:

```js
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { joinRequestDoc, memberRecord, membershipCopy, newInviteCode } from "../utils/clubs";
import { leaveClub } from "../utils/accountData";

// Removes this person's own "My clubs" card (a stale one: they were removed, or the club is gone).
export const removeMyCopy = (uid, clubId) => deleteDoc(doc(db, "accounts", uid, "memberships", clubId));

// Every write for joining, leaving and managing members. Each one rejects on failure; the screens turn
// that into a message. `name` is the signed-in person's name; `club` is the open club's document.
export function useMembershipActions({ uid, name, clubId, club }) {
  const requestRef = (id) => doc(db, "clubs", clubId, "joinRequests", id);
  const memberRef = (id) => doc(db, "clubs", clubId, "members", id);
  const cardRef = (id) => doc(db, "accounts", id, "memberships", clubId);

  const requestToJoin = (message) => setDoc(requestRef(uid), joinRequestDoc(name, message, Date.now()));
  // Withdraw a pending request, or dismiss a declined one.
  const cancelRequest = () => deleteDoc(requestRef(uid));

  // The invite code travels on the new member record; the rules compare it to the club's current code.
  const joinWithInvite = async (code) => {
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(memberRef(uid), memberRecord(name, now, code));
    batch.set(cardRef(uid), membershipCopy(club, "member", now));
    await batch.commit();
  };

  // Approve: the member record, their "My clubs" card and the request go in one batch. If they already
  // joined another way (an invite link) the batch is refused; then just clear the request.
  const approve = async (request) => {
    const now = Date.now();
    try {
      const batch = writeBatch(db);
      batch.set(memberRef(request.id), memberRecord(request.name, now));
      batch.set(cardRef(request.id), membershipCopy(club, "member", now));
      batch.delete(requestRef(request.id));
      await batch.commit();
    } catch (err) {
      if (!(await getDoc(memberRef(request.id))).exists()) throw err;
      await deleteDoc(requestRef(request.id));
    }
  };
  const decline = (request) => updateDoc(requestRef(request.id), { status: "declined" });

  const leave = () => leaveClub(db, clubId, uid);

  const removeMember = async (member) => {
    const batch = writeBatch(db);
    batch.delete(memberRef(member.id));
    batch.delete(cardRef(member.id));
    await batch.commit();
  };

  // Creates the invite link, or replaces it (every old link stops working). Resolves to the new code.
  const saveInvite = async () => {
    const code = newInviteCode();
    await setDoc(doc(db, "clubs", clubId, "private", "invite"), { code });
    return code;
  };

  return { requestToJoin, cancelRequest, joinWithInvite, approve, decline, leave, removeMember, saveInvite };
}
```

- [ ] **Step 3: Verify and commit**

Run: `npx vite build`
Expected: succeeds (nothing imports the new hooks yet). Then `git checkout -- dist && git clean -fdq dist`.

```bash
git add src/hooks/useMembership.js src/hooks/useMembershipActions.js
git commit -m "feat: directory, members, requests and invite listeners; membership actions" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Screens

**Files:**
- Create: `src/views/FindClubs.jsx`, `src/views/ClubMembers.jsx`, `src/components/JoinPanel.jsx`
- Modify: `src/views/Hub.jsx`, `src/AccountApp.jsx`, `src/ClubApp.jsx`, `src/components/ShareModal.jsx`, `src/clubs.css`

**Interfaces:**
- Consumes: Tasks 1 and 4.
- Produces: `<FindClubs myClubs navigate />`, `<JoinPanel uid clubId club invite actions notify onJoined />`, `<ClubMembers clubId club uid canManage isOwner requests actions navigate notify />`; the Members tab and routes `clubs-find`, `club-members`.

- [ ] **Step 1: Find a club**

Create `src/views/FindClubs.jsx`:

```jsx
import { useState } from "react";
import { ArrowLeft, MapPin, Search } from "lucide-react";
import PageTitle from "../components/PageTitle";
import { useDirectory } from "../hooks/useMembership";
import { ROLE_LABEL, clubPath, filterClubs } from "../utils/clubs";

// Public clubs, searched on the device (the name or place contains the text). A row opens the club page,
// where the person can ask to join. Private clubs are joined with an invite link, so they are not here.
export default function FindClubs({ myClubs, navigate }) {
  const [text, setText] = useState("");
  const { clubs, ready, error } = useDirectory();
  const mine = new Map(myClubs.map((c) => [c.id, c.role]));
  const shown = filterClubs(clubs, text);
  const open = (id) => (e) => { e.preventDefault(); navigate(clubPath(id)); };

  return (
    <div className="page-narrow">
      <a className="back-link" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}><ArrowLeft size={14} /> My clubs</a>
      <PageTitle title="Find a club" sub="Public clubs you can ask to join. Private clubs are joined with an invite link." />
      <label className="find-search">
        <Search size={16} />
        <input
          type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Search by club name or place" aria-label="Search clubs" autoFocus
        />
      </label>
      {!ready ? (
        <p className="hub-empty">Loading clubs…</p>
      ) : error ? (
        <div className="panel notice"><p>Couldn't load the clubs. Check your connection and try again.</p></div>
      ) : !shown.length ? (
        <p className="hub-empty">{text.trim() ? "No public club matches that. Try another name or place." : "No public clubs yet."}</p>
      ) : (
        <div className="find-list">
          {shown.map((c) => (
            <a key={c.id} className="find-row" href={clubPath(c.id)} onClick={open(c.id)}>
              <span className="find-main">
                <b>{c.name}</b>
                {c.location && <small><MapPin size={12} /> {c.location}</small>}
                {c.description && <small className="find-about">{c.description}</small>}
              </span>
              {mine.has(c.id) && <span className="pill">{ROLE_LABEL[mine.get(c.id)] || ROLE_LABEL.member}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: The join panel**

Create `src/components/JoinPanel.jsx`:

```jsx
import { useState } from "react";
import { Lock } from "lucide-react";
import { useMyJoinRequest } from "../hooks/useMembership";
import { JOIN_MESSAGE_MAX, validateJoinMessage } from "../utils/clubs";

// What a signed-in person who is not in the club sees: use an invite link, or ask to join a public
// club. Once they are a member the club page switches to the member view by itself.
export default function JoinPanel({ uid, clubId, club, invite, actions, notify, onJoined }) {
  const { request, ready } = useMyJoinRequest(uid, clubId);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn, failMessage) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(typeof failMessage === "function" ? failMessage(err) : failMessage);
    }
    setBusy(false);
  };

  if (invite) {
    return (
      <div className="panel join-panel">
        <h2 className="club-section">You're invited to join {club.name}</h2>
        <p>Joining adds you as a member right away.</p>
        {error && <p className="join-error" role="alert">{error}</p>}
        <button
          className="primary" disabled={busy}
          onClick={() => run(async () => { await actions.joinWithInvite(invite); notify(`You joined ${club.name}.`); onJoined(); },
            (err) => (err?.code === "permission-denied"
              ? "This invite link is no longer valid. Ask a manager for a new one."
              : "Couldn't join. Check your connection and try again."))}
        >
          Join club
        </button>
      </div>
    );
  }

  if (club.visibility !== "public") {
    return <div className="panel notice"><p><Lock size={14} /> This club is private. Ask a manager for an invite link.</p></div>;
  }
  if (!ready) return <p className="hub-empty">Loading…</p>;

  if (request?.status === "pending") {
    return (
      <div className="panel join-panel">
        <h2 className="club-section">Request sent</h2>
        <p>A manager will review it. You'll see the club's members here once you're in.</p>
        {error && <p className="join-error" role="alert">{error}</p>}
        <button className="outline" disabled={busy} onClick={() => run(actions.cancelRequest, "Couldn't withdraw the request. Try again.")}>Withdraw request</button>
      </div>
    );
  }
  if (request?.status === "declined") {
    return (
      <div className="panel join-panel">
        <h2 className="club-section">Your request was declined</h2>
        <p>You can dismiss this and ask again later.</p>
        {error && <p className="join-error" role="alert">{error}</p>}
        <button className="outline" disabled={busy} onClick={() => run(actions.cancelRequest, "Couldn't dismiss it. Try again.")}>Dismiss</button>
      </div>
    );
  }

  const send = (e) => {
    e.preventDefault();
    const problem = validateJoinMessage(message);
    if (problem) return setError(problem);
    run(async () => { await actions.requestToJoin(message); setMessage(""); }, "Couldn't send your request. Check your connection and try again.");
  };
  return (
    <form className="panel join-panel" onSubmit={send}>
      <h2 className="club-section">Join {club.name}</h2>
      <p>Send a request. A manager will approve it.</p>
      <label>
        Message to the managers <small>(optional)</small>
        <textarea rows={3} value={message} maxLength={JOIN_MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} placeholder="Who you are and when you play." />
      </label>
      {error && <p className="join-error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>Request to join</button>
    </form>
  );
}
```

- [ ] **Step 3: The members screen**

Create `src/views/ClubMembers.jsx`:

```jsx
import { useState } from "react";
import { LogOut, Link2, RefreshCw, Share2 } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import PageTitle from "../components/PageTitle";
import ShareModal from "../components/ShareModal";
import { useInvite, useMembers } from "../hooks/useMembership";
import { formatDate } from "../utils/format";
import { ROLE_LABEL, inviteUrl } from "../utils/clubs";

// Everyone in the club sees who is in it. Plain members can leave; managers also review join requests,
// manage the invite link and remove plain members.
export default function ClubMembers({ clubId, club, uid, canManage, isOwner, requests, actions, navigate, notify }) {
  const { members, ready } = useMembers(clubId);
  const { code, ready: inviteReady } = useInvite(canManage ? clubId : null);
  const [confirm, setConfirm] = useState(null); // { kind: "remove", member } | { kind: "leave" } | { kind: "reset" }
  const [showShare, setShowShare] = useState(false);
  const [busy, setBusy] = useState(false);

  // One action at a time; a failure says so instead of failing silently.
  const act = async (fn, okMessage, failMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (okMessage) notify(okMessage);
    } catch {
      notify(failMessage, 4000);
    }
    setBusy(false);
  };

  return (
    <>
      <PageTitle
        title="Members"
        sub={isOwner ? "You own this club. To step away, delete it in Settings." : ready ? `${members.length} in this club` : undefined}
      >
        {!isOwner && <button className="outline" onClick={() => setConfirm({ kind: "leave" })}><LogOut size={15} /> Leave club</button>}
      </PageTitle>

      {canManage && requests.length > 0 && (
        <div className="panel members-block">
          <h2 className="club-section">Join requests <span className="count-badge">{requests.length}</span></h2>
          {requests.map((r) => (
            <div className="member-row" key={r.id}>
              <div className="member-main">
                <b>{r.name}</b>
                {r.message && <small>{r.message}</small>}
              </div>
              <div className="member-actions">
                <button className="primary" disabled={busy} onClick={() => act(() => actions.approve(r), `${r.name} joined the club.`, "Couldn't approve. Check your connection and try again.")}>Approve</button>
                <button className="outline" disabled={busy} onClick={() => act(() => actions.decline(r), `Declined ${r.name}.`, "Couldn't decline. Try again.")}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="panel members-block">
          <h2 className="club-section">Invite link</h2>
          <p className="members-help">Anyone signed in with this link joins right away, even a private club. Reset it to stop old links.</p>
          {!inviteReady ? (
            <p className="hub-empty">Loading…</p>
          ) : code ? (
            <div className="member-actions">
              <button className="primary" onClick={() => setShowShare(true)}><Share2 size={15} /> Share invite link</button>
              <button className="outline" disabled={busy} onClick={() => setConfirm({ kind: "reset" })}><RefreshCw size={15} /> Reset link</button>
            </div>
          ) : (
            <button className="primary" disabled={busy} onClick={() => act(actions.saveInvite, "Invite link created.", "Couldn't create the link. Try again.")}><Link2 size={15} /> Create invite link</button>
          )}
        </div>
      )}

      <div className="panel members-block">
        <h2 className="club-section">Everyone</h2>
        {!ready ? (
          <p className="hub-empty">Loading members…</p>
        ) : members.map((m) => (
          <div className="member-row" key={m.id}>
            <div className="member-main">
              <b>{m.name}{m.id === uid ? " (you)" : ""}</b>
              {m.joinedAt && <small>Joined {formatDate(m.joinedAt)}</small>}
            </div>
            <div className="member-actions">
              <span className="pill">{ROLE_LABEL[m.role] || ROLE_LABEL.member}</span>
              {canManage && m.role === "member" && m.id !== uid && (
                <button className="outline" disabled={busy} onClick={() => setConfirm({ kind: "remove", member: m })}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showShare && code && (
        <ShareModal
          url={inviteUrl(window.location.origin, clubId, code)} close={() => setShowShare(false)}
          title="Share invite link" label="INVITE LINK" openLabel="Open link" qr
          hint={`Anyone signed in with this link joins ${club.name} right away. Reset the link on this page to stop old ones.`}
        />
      )}
      {confirm?.kind === "remove" && (
        <ConfirmDialog
          title={`Remove ${confirm.member.name}?`} message="They lose access to this club. They can ask to join again." confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const m = confirm.member;
            setConfirm(null);
            act(() => actions.removeMember(m), `${m.name} was removed.`, "Couldn't remove them. Check your connection and try again.");
          }}
        />
      )}
      {confirm?.kind === "leave" && (
        <ConfirmDialog
          title={`Leave ${club.name}?`} message="You lose access to this club. You can ask to join again, or use an invite link." confirmLabel="Leave club"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            act(async () => { await actions.leave(); navigate("/"); }, `You left ${club.name}.`, "Couldn't leave. Check your connection and try again.");
          }}
        />
      )}
      {confirm?.kind === "reset" && (
        <ConfirmDialog
          title="Reset the invite link?" message="Old links stop working. Share the new link with the people you still want to invite." confirmLabel="Reset link"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            act(actions.saveInvite, "New invite link created. Old links no longer work.", "Couldn't reset the link. Try again.");
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Wire the screens**

Write `ui-screens.cjs` in the scratchpad (the same `edit` helper) and run it:

```js
// ShareModal: the label above the link is no longer always "PUBLIC LINK".
edit("src/components/ShareModal.jsx", [
  ['  url, close, title = "Share Live Board", openLabel = "Open Live Board", qr = false,', '  url, close, title = "Share Live Board", label = "PUBLIC LINK", openLabel = "Open Live Board", qr = false,'],
  ['<Modal title={title} label="PUBLIC LINK" close={close}>', "<Modal title={title} label={label} close={close}>"],
]);

// Hub: a "Find a club" entry next to "Create a club", and in the empty state.
edit("src/views/Hub.jsx", [
  ['import { ChevronRight, ListOrdered, Plus, Users } from "lucide-react";', 'import { ChevronRight, ListOrdered, Plus, Search, Users } from "lucide-react";'],
  [`          <a className="primary" href="/clubs/new" onClick={to("/clubs/new")}><Plus size={15} /> Create a club</a>`,
`          <div className="hub-start-actions">
            <a className="primary" href="/clubs/new" onClick={to("/clubs/new")}><Plus size={15} /> Create a club</a>
            <a className="outline" href="/clubs/find" onClick={to("/clubs/find")}><Search size={15} /> Find a club</a>
          </div>`],
  [`            <b>Create a club</b>
          </a>
        </div>`,
`            <b>Create a club</b>
          </a>
          <a className="hub-card hub-card-new" href="/clubs/find" onClick={to("/clubs/find")}>
            <Search size={22} />
            <b>Find a club</b>
          </a>
        </div>`],
]);

// AccountApp: the find screen.
edit("src/AccountApp.jsx", [
  ['import CreateClub from "./views/CreateClub";', 'import CreateClub from "./views/CreateClub";\nimport FindClubs from "./views/FindClubs";'],
  [`        ) : route === "clubs-new" ? (
          <CreateClub onCreate={clubActions.createClub} navigate={navigate} />`,
`        ) : route === "clubs-new" ? (
          <CreateClub onCreate={clubActions.createClub} navigate={navigate} />
        ) : route === "clubs-find" ? (
          <FindClubs myClubs={clubs} navigate={navigate} />`],
]);

// ClubApp: the members tab, the join panel, role-aware loading, stale cards.
edit("src/ClubApp.jsx", [
  ['import { Suspense, lazy, useRef, useState } from "react";', 'import { Suspense, lazy, useEffect, useRef, useState } from "react";'],
  ['import { useGameActions } from "./hooks/useGameActions";', 'import { useGameActions } from "./hooks/useGameActions";\nimport { useJoinRequests } from "./hooks/useMembership";\nimport { removeMyCopy, useMembershipActions } from "./hooks/useMembershipActions";\nimport { useMyClubs } from "./hooks/useMyClubs";'],
  ['import ClubSettings from "./views/ClubSettings";', 'import ClubMembers from "./views/ClubMembers";\nimport ClubSettings from "./views/ClubSettings";'],
  ['import AccountBar from "./components/AccountBar";', 'import AccountBar from "./components/AccountBar";\nimport JoinPanel from "./components/JoinPanel";'],
  // one restricted-page notice for both roles
  [`function ManagersOnly({ base, navigate }) {
  return (
    <div className="panel notice">
      <p>This page is for the club's managers.</p>`,
`function Restricted({ text, base, navigate }) {
  return (
    <div className="panel notice">
      <p>{text}</p>`],
  [`
// Everything under /clubs/:id.`,
`const ManagersOnly = (props) => <Restricted text="This page is for the club's managers." {...props} />;
const MembersOnly = (props) => <Restricted text="This page is for the club's members." {...props} />;

// Everything under /clubs/:id.`],
  ['  const { club, role, canManage, isOwner } = info;', '  const { club, role, isMember, canManage, isOwner } = info;'],
  // events only for people who may read them; requests and the invite only for managers
  ['  const { events, fromServer: eventsReady } = useEvents(ready ? clubId : null);',
   `  // Public clubs show open play to everyone, private ones to members only (no listener for anyone else).
  const canSee = ready && (club.visibility === "public" || isMember);
  const { events, fromServer: eventsReady } = useEvents(canSee ? clubId : null);
  const { requests: pendingRequests } = useJoinRequests(ready && canManage ? clubId : null);
  const personName = acct.account?.name || acct.account?.clubName;
  const membership = useMembershipActions({ uid, name: personName, clubId, club });
  const invite = new URLSearchParams(window.location.search).get("invite");
  // A "My clubs" card for a club the person is not in (they were removed, or it was deleted) cleans itself
  // up. The short wait covers the moment right after joining, when the card can arrive before the record.
  const { clubs: myClubs } = useMyClubs(uid);
  const hasCard = myClubs.some((c) => c.id === clubId);
  useEffect(() => {
    if (info.status === "loading" || isMember || !hasCard) return undefined;
    const t = setTimeout(() => { removeMyCopy(uid, clubId).catch(() => {}); }, 2500);
    return () => clearTimeout(t);
  }, [info.status, isMember, hasCard, uid, clubId]);`],
  [`    if (route === "club") {
      return <ClubHome canManage={canManage} events={events} fallbackZone={fallbackZone} base={base} navigate={navigate} onNew={() => setEventModal("new")} />;
    }
    if (!canManage) return <ManagersOnly base={base} navigate={navigate} />;`,
`    if (route === "club") {
      return (
        <>
          {!isMember && (
            <JoinPanel
              uid={uid} clubId={clubId} club={club} invite={invite} actions={membership} notify={notify}
              onJoined={() => navigate(base)}
            />
          )}
          {canSee && <ClubHome canManage={canManage} events={events} fallbackZone={fallbackZone} base={base} navigate={navigate} onNew={() => setEventModal("new")} />}
        </>
      );
    }
    if (route === "club-members") {
      if (!isMember) return <MembersOnly base={base} navigate={navigate} />;
      return (
        <ClubMembers
          clubId={clubId} club={club} uid={uid} canManage={canManage} isOwner={isOwner}
          requests={pendingRequests} actions={membership} navigate={navigate} notify={notify}
        />
      );
    }
    if (!canManage) return <ManagersOnly base={base} navigate={navigate} />;`],
  ['<section className={`club-head${canManage ? "" : " solo"}`}>', '<section className={`club-head${isMember ? "" : " solo"}`}>'],
  [`        {canManage && (
          <nav className="club-tabs" aria-label="Club">
            {tab(base, "Overview", "club")}
            {tab(\`\${base}/host\`, "Open play", "club-host", "club-event")}
            {tab(\`\${base}/settings\`, "Settings", "club-settings")}
          </nav>
        )}`,
`        {isMember && (
          <nav className="club-tabs" aria-label="Club">
            {tab(base, "Overview", "club")}
            {canManage && tab(\`\${base}/host\`, "Open play", "club-host", "club-event")}
            {tab(\`\${base}/members\`, <>Members{canManage && pendingRequests.length > 0 && <span className="count-badge">{pendingRequests.length}</span>}</>, "club-members")}
            {canManage && tab(\`\${base}/settings\`, "Settings", "club-settings")}
          </nav>
        )}`],
]);
console.log("screens wired");
```

Run it, then: `grep -n "ManagersOnly\|MembersOnly" src/ClubApp.jsx`
Expected: `screens wired`; the definitions and the uses show up (the existing `ManagersOnly` calls keep working).

- [ ] **Step 5: Styles**

Append to `src/clubs.css`:

```css

/* ---- Part B: find a club, join panel, members ---- */
.hub-start-actions{display:flex;flex-wrap:wrap;gap:8px}
.find-search{display:flex;align-items:center;gap:8px;min-height:46px;padding:0 12px;margin:0 0 14px;border:1px solid var(--card-line);border-radius:12px;background:var(--panel);color:var(--muted)}
.find-search:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-ring)}
.find-search input{flex:1;min-height:44px;border:0;background:transparent;color:var(--ink);font:inherit}
.find-search input:focus{outline:none;box-shadow:none;border:0}
.find-list{display:grid;gap:10px}
.find-row{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--card-line);border-radius:15px;background:var(--panel);color:var(--ink);text-decoration:none;transition:border-color .15s ease,background .15s ease}
.find-row:hover{border-color:var(--accent-line);background:var(--hover)}
.find-main{display:grid;gap:3px;flex:1}
.find-main b{font:700 16px "Space Grotesk";overflow-wrap:anywhere}
.find-main small{display:flex;align-items:center;gap:4px;color:var(--muted);font-size:13px}
.find-about{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.join-panel{display:grid;gap:12px;justify-items:start;padding:20px;margin:0 0 18px}
.join-panel p{margin:0;color:var(--ink-2);line-height:1.5;max-width:62ch}
.join-panel .club-section{margin:0}
.join-panel label{display:grid;gap:6px;width:100%;max-width:520px;font-weight:700;font-size:13px}
.join-panel label small{color:var(--muted);font-weight:500}
.join-panel textarea{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);resize:vertical}
.join-panel .join-error{color:var(--danger-ink);font-weight:600}
.members-block{margin:0 0 18px}
.members-block .club-section{margin:0 0 4px}
.members-help{margin:0 0 10px;color:var(--muted);font-size:13.5px;line-height:1.5;max-width:62ch}
.member-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 12px;padding:12px 0;border-top:1px solid var(--card-line)}
.member-main{display:grid;gap:2px;min-width:0}
.member-main b{overflow-wrap:anywhere}
.member-main small{color:var(--muted);font-size:13px;overflow-wrap:anywhere}
.member-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.club-tabs .count-badge{margin-left:6px}
```

- [ ] **Step 6: Verify and commit**

Run: `npx vite build && node src/utils/clubs.check.mjs && node src/utils/route.check.mjs`
Expected: build succeeds, checks print `ok`. Then `git checkout -- dist && git clean -fdq dist`.

```bash
git add src/views/FindClubs.jsx src/views/ClubMembers.jsx src/components/JoinPanel.jsx src/views/Hub.jsx src/AccountApp.jsx src/ClubApp.jsx src/components/ShareModal.jsx src/clubs.css
git commit -m "feat: find a club, join panel, members tab, invite link sharing" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Browser pass, docs, full check

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-08-clubs-design.md`, and any file a check below shows is wrong

Run `npm run emulators` in the background, wait for "All emulators ready", then `npm run dev:emu` and open `http://localhost:5300/`. Use three browser contexts (`browser.newContext()`): **Alex** (owner), **Sam**, **Ana**, each signed up with `<name>@example.com` / `secret12`. Use DOM clicks for Select menus.

- [ ] **Step 1: Setup and directory**

Alex creates a public club "Centro" (location "Manila", description) and a private club "Hush". As Sam: hub shows "Find a club"; Find a club lists Centro but not Hush; searching "man" finds Centro (place), "zzz" shows "No public club matches that…", an uppercase "CEN" matches. Opening Centro as Sam shows the header, no tabs, the "Join Centro" panel and Centro's open play list. Screenshot (light and dark).

- [ ] **Step 2: Request, approve, decline, and races (Review Focus 5)**

Sam sends a request with a message: panel becomes "Request sent" with "Withdraw request". Withdraw it, send again. Alex: Members tab shows a count badge "1"; Join requests lists Sam with the message. Double-click Approve quickly: Sam appears once in Everyone as Member, the request is gone, a toast says "Sam joined the club." As Sam (no reload): the page switches to the member view with tabs Overview and Members, and Centro shows under My clubs with "Member". Ana requests; Alex declines: Ana sees "Your request was declined" with Dismiss; Dismiss, request again, Alex approves. Race: Ana (a new third person "Bo") requests, then joins by the invite link before Alex approves: Alex's Approve clears the request without an error.

- [ ] **Step 3: Invite links (Review Focus 3)**

Alex, Members, Invite link: "Create invite link", Share invite link opens the dialog (label INVITE LINK, QR, copy). As Ana, open the link for **Hush** (private): header and "You're invited to join Hush", Join club: lands on Hush as a member. Alex resets the link (confirmation dialog); opening the old link as a new person ("Cy") shows the red message "This invite link is no longer valid. Ask a manager for a new one." and no crash; the new link works.

- [ ] **Step 4: Non-member and private views (Review Focus 4)**

As Cy (not a member of Hush): `/clubs/<Hush id>` shows only the header, description and "This club is private. Ask a manager for an invite link."; no tabs, no "No open play" line, and the browser console has no permission-denied errors. `/clubs/<Hush id>/members` and `/host` show the restricted-page notices. Public club Centro as Cy still shows its open play list. Members of Hush (Ana) see the open play list and the Members tab.

- [ ] **Step 5: Leave and remove (Review Focus 2)**

Sam leaves Centro (Members, Leave club, confirm): back on the hub, Centro's card is gone, and Alex's list no longer has Sam. Alex removes Ana from Hush (Remove, confirm): Ana's open Hush page returns to the non-member view within a few seconds and her hub card disappears. The owner has no Leave button and the page says to delete the club in Settings.

- [ ] **Step 6: Delete cascades (Review Focus 2)**

Sam joins Hush by invite. Alex deletes Hush from Settings: Sam's hub card disappears after a reload. Sam (plain member of Centro again via a request) deletes their account from Profile: Alex's Members list no longer shows Sam. Check the emulator data with `fetch("http://127.0.0.1:8080/v1/projects/demo-courtflow/databases/(default)/documents/clubs", { headers: { Authorization: "Bearer owner" } })` that no deleted club or ghost member remains.

- [ ] **Step 7: Responsive and keyboard**

At 390 and 360 px: no horizontal overflow on Find a club, the join panel, Members (with requests and invite panels). Tab through Members: every control shows a focus ring in order. Fix anything that differs, in `src/clubs.css` first.

- [ ] **Step 8: Existing checks, docs**

Stop the servers. Run: `node src/utils/clubs.check.mjs && node src/utils/route.check.mjs && node src/utils/account.check.mjs && node src/utils/paths.check.mjs && node src/utils/bookings.check.mjs && node src/utils/gameSession.check.mjs && node src/utils/stats.check.mjs && node src/utils/theme.check.mjs && node src/utils/rotationModes.check.mjs && npm run test:rules && npx vite build`
Expected: every check `ok`/`passed`, `rules: all assertions passed`, `cascade: ok`, `membership: all assertions passed`, build succeeds. Then `git checkout -- dist && git clean -fdq dist; git clean -fdq .playwright-mcp`.

In `docs/superpowers/specs/2026-10-08-clubs-design.md` replace the last Risks bullet ending `part B's search needs no extra index (a single-field range query on a field in one collection).` with `part B's directory search needs no index: it loads up to 200 public clubs and filters them on the device (see the part B spec).` and in the "Parts B and C in outline" paragraph replace `searches public clubs by name prefix (a \`nameLower\` field on the club doc, queried by range)` with `searches public clubs by name or place (loaded once, filtered on the device; \`nameLower\` stays on the club doc for a later server-side search)`.

In `CLAUDE.md`, directly after the "Hub and club screens share one frame" bullet add:

```md
- Clubs part B (`docs/superpowers/specs/2026-10-08-clubs-part-b-design.md`): joining. A person asks to join a public club (`clubs/{id}/joinRequests/{uid}`, pending or declined) or joins any club with its invite link (`/clubs/:id?invite=CODE`; the code lives in `clubs/{id}/private/invite` and travels on the new member record, which the rules compare to the current code, so a reset stops old links). A manager approves with one batch (member record + the person's `accounts/{uid}/memberships/{clubId}` card + the request); the rules mirror the card write with `getAfter` / `existsAfter`, so a manager can only create or delete a card in the same batch as the member-record change. Screens: `/clubs/find` (public clubs, up to 200, filtered on the device; no index), the join panel (`JoinPanel`) on the club page for non-members, and the Members tab (`ClubMembers`: requests, invite link, remove, leave). Pure helpers: `utils/clubs.js` (`newInviteCode`, `inviteUrl`, `filterClubs`, ...); rules test: `tests/membership.test.mjs`. Deleting a club removes every member's card; deleting an account leaves its clubs first (`leaveClub`). A stale card cleans itself up after a 2.5 s check in `ClubApp`. The new rules must be published in the Firebase console.
```

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-08-clubs-design.md src/clubs.css
git commit -m "docs: record clubs part B; browser pass fixes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(Add any other path a step 1 to 7 fix touched.)

- [ ] **Step 10: Publish note (do not run without approval)**

`firestore.rules` changed: publish it in the Firebase console (Rules tab, Publish) before the deployed site can use joining. No index is needed. Hosting needs a rebuild and `firebase deploy --only hosting` when you want it live.

---

## Self-review

**Spec coverage:** data model (join request, invite doc, member `inviteCode`, cards) Tasks 1, 2; rules (request create/read/update/delete, three ways into the member list, four ways out, manager-mirrored cards, cascade) Tasks 2, 3; screens (find a club, join panel with request/withdraw/dismiss/invite/private message, Members tab with requests/invite/remove/leave, tabs for managers and members, hub entry, stale cards, account delete leaving clubs) Tasks 3, 5; pure helpers and routes Task 1; testing (pure checks, rules matrix, cascade, browser pass) Tasks 1 to 6; spec corrections (index, invite code visibility) Task 6 step 8 and the spec itself. Deviations: directory rows show only the Member pill (request state is on the club page); a stale card removes itself after 2.5 s instead of via a "Remove from My clubs" button.

**Placeholder scan:** none; every code step has full code or exact replacement strings, and every browser step lists exact actions and outcomes.

**Type consistency:** `memberRecord(name, now, inviteCode?)` and `joinRequestDoc(name, message, now)` (Task 1) are used by `useMembershipActions` (Task 4) and match the rule field sets (`role, name, joinedAt[, inviteCode]`; `name, message?, status, createdAt`). `leaveClub(db, clubId, uid)` (Task 3) is used by `leave` (Task 4). Hook shapes in Task 4 match their uses: `useMembers` and `useMembership` return `{ members, ready }`, `{ requests, ready }`, `{ request, ready }`, `{ code, ready }`, `{ clubs, ready, error }`. `ClubMembers` props match the call in `ClubApp` (`clubId club uid canManage isOwner requests actions navigate notify`); `JoinPanel` props match (`uid clubId club invite actions notify onJoined`). `ShareModal`'s new `label` prop has the old text as its default.

**Review Focus coverage:** 1 by `tests/membership.test.mjs`; 2 by `tests/cascade.test.mjs` and browser steps 5, 6; 3 by the rules test and browser step 3; 4 by browser step 4; 5 by `approve`'s fallback, the `busy` flags and browser step 2.
