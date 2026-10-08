# Account and Club Screens UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The hub, create club, club pages (overview, open play, event page, settings) and profile share one top bar, one page frame, one title style, one button and card style, in light and dark, on desktop and phone.

**Architecture:** Two small shared components (`AccountBar`, `PageTitle`) make both shells (`AccountApp`, `ClubApp`) render the same bar and titles. `ClubApp` gains a club header with a tab strip (Overview, Open play, Settings) and loses the duplicate buttons. All new CSS goes in `src/clubs.css`, scoped under `.acct-shell` and loaded after `styles.css`, so the queue app, public page and Live Board cannot change.

**Tech Stack:** React 19, Vite, lucide-react, plain CSS with `light-dark()` tokens, Firebase emulators + Playwright MCP for the browser pass.

**Spec:** `docs/superpowers/specs/2026-10-08-account-club-ui-design.md`

## Global Constraints

- Every color is a token on `:root` in `src/styles.css` (`var(--accent)`, `var(--line)`, `var(--panel)`, `var(--muted)` ...). Never raw hex. (CLAUDE.md)
- No avatar-initial badges next to player names. Plain names only.
- `src/styles.css` is NOT edited. All new CSS is in `src/clubs.css`, every rule under `.acct-shell` (or a class only used inside it).
- No new dependencies, no router library. Copy: sentence case, active voice; one name per action ("New open play", "Create a club").
- Touch targets at least 44px; visible keyboard focus; no horizontal page scroll from 360px; body text contrast 4.5:1 in both themes.
- Files may use CRLF line endings. Edit with the `edit(file, pairs)` script helper shown in each task (it normalizes to LF, checks every anchor exists, and writes the original line endings back). Never use `sed` for multi-line edits.
- `dist/` is tracked: after every `npx vite build`, run `git checkout -- dist && git clean -fdq dist`; never commit a rebuild. `.playwright-mcp/` is tracked: never `rm -rf` it; clean untracked screenshots with `git clean -fdq .playwright-mcp`.
- Commit only the paths a step lists, never `git add -A`. End commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Never deploy, push or merge. Browser checks run on the local emulators (`npm run emulators`, `npm run dev:emu`, port 5300): no production data.

## Review Focus

Conditions the spec implies but the happy path will not exercise, most likely first. Each is pinned by a named step in Task 4.

1. **A non-manager (member or stranger) on a club URL** sees the header but no tab strip and no "New open play" button; manager-only URLs still show the "managers" message. (Task 4, step 3)
2. **Phone width (360 and 390 px):** no horizontal page scroll on any screen, account chip is icon-only, tab strip stays reachable. (Task 4, step 2)
3. **Dark mode:** card borders visible; inside a club the club's own theme applies (set the club theme to Dark to check). (Task 4, step 4)
4. **Long names:** a 60-character club name and a long account name wrap or ellipsize without overflow. (Task 4, step 5)
5. **Hub states:** while clubs load there is no flash of the "Create your first club" call to action; with no clubs, one clear call to action; with 7 clubs, the grid wraps cleanly. (Task 4, step 6)

Also checked in Task 4: keyboard order through bar, tabs and actions with visible focus, Esc closes the account menu, and no anchor shows the browser's purple link colour.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/AccountBar.jsx` (new) | The one top bar: logo, My clubs, account chip. Used by both shells. |
| `src/components/PageTitle.jsx` (new) | Page title row: `h1`, optional subtitle, right-aligned actions. |
| `src/utils/clubs.js`, `clubs.check.mjs` (modify) | `ROLE_LABEL` shared by the hub and the club header. |
| `src/clubs.css` (rewrite) | Page frame, bar, titles, buttons, cards, club header and tabs, hub, phone rules. |
| `src/ClubApp.jsx` (modify) | Club header + tab strip; uses `AccountBar`; passes `onNew` to the overview. |
| `src/AccountApp.jsx` (modify) | Uses `AccountBar`. |
| `src/views/ClubHome.jsx`, `Host.jsx`, `Hub.jsx`, `CreateClub.jsx`, `Profile.jsx`, `ClubSettings.jsx` (modify) | `PageTitle`, narrow forms, hub layout, compact empty states. |
| `src/components/AccountMenu.jsx`, `styles.css` account-menu rules (already in the working tree, owner's edits) | The account chip. Committed first in Task 1. |
| `CLAUDE.md` (modify) | One bullet on the shell conventions. |

## Before you start

- [ ] Branch `feat/accounts-hub`. Run `git status --short`. Expected: `M src/AccountApp.jsx`, `M src/ClubApp.jsx`, `M src/styles.css`, `?? src/components/AccountMenu.jsx` (the owner's account-menu work). Task 1 step 1 deals with it.
- [ ] `node src/utils/clubs.check.mjs` prints `clubs.check: ok`.

---

### Task 1: Shared pieces and the page frame

**Files:**
- Create: `src/components/AccountBar.jsx`, `src/components/PageTitle.jsx`
- Modify: `src/utils/clubs.js`, `src/utils/clubs.check.mjs`
- Rewrite: `src/clubs.css`
- Commit first (owner's edits): `src/AccountApp.jsx`, `src/ClubApp.jsx`, `src/styles.css`, `src/components/AccountMenu.jsx`

**Interfaces:**
- Produces: `ROLE_LABEL = { owner: "Owner", manager: "Manager", member: "Member" }` from `utils/clubs`; `<AccountBar active name email onSignOut navigate />` (`active` = highlight "My clubs"); `<PageTitle title sub>{actions}</PageTitle>`; CSS classes `page-title`, `page-title-actions`, `page-narrow`, `club-head`, `club-head.solo`, `club-head-top`, `club-tabs`, `panel-row`, `hub-start`, `hub-row`, `hub-card-new`.

- [ ] **Step 1: Settle the account-menu edits already in the working tree**

Run: `git diff src/AccountApp.jsx src/ClubApp.jsx src/styles.css | grep '^[+-]' | grep -v '^+++\|^---' | grep -vi 'account-menu\|AccountMenu\|LogOut\|Sign out\|Profile\|signOut'`
Expected: no output (every changed line is about the account menu). If anything else prints, STOP and ask the owner: those are edits that are not part of this plan.

Then:

```bash
npx vite build; git checkout -- dist && git clean -fdq dist
git add src/AccountApp.jsx src/ClubApp.jsx src/styles.css src/components/AccountMenu.jsx
git commit -m "feat: account menu in the top bar (owner's edits, committed before the UI pass)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Expected: build succeeds; `git status --short` is clean afterwards.

- [ ] **Step 2: Write the failing check for `ROLE_LABEL`**

In `src/utils/clubs.check.mjs` change the import line to
`import { ROLE_LABEL, clubPath, membershipCopy, newClubDoc, permissions, validateClubInput } from "./clubs.js";`
and add before the final `console.log`:

```js
// One set of role names for every screen.
assert.deepEqual(ROLE_LABEL, { owner: "Owner", manager: "Manager", member: "Member" });
```

Run: `node src/utils/clubs.check.mjs`
Expected: FAIL with `SyntaxError ... does not provide an export named 'ROLE_LABEL'`.

- [ ] **Step 3: Implement `ROLE_LABEL`**

Append to `src/utils/clubs.js`:

```js

// Role names as shown on screen (hub cards, club header).
export const ROLE_LABEL = { owner: "Owner", manager: "Manager", member: "Member" };
```

Run: `node src/utils/clubs.check.mjs`
Expected: `clubs.check: ok`.

- [ ] **Step 4: The two shared components**

Create `src/components/PageTitle.jsx`:

```jsx
// The title row every hub and club screen starts with: title, one optional line under it, and the
// page's actions on the right (they wrap below the title on a phone).
export default function PageTitle({ title, sub, children }) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-title-actions">{children}</div>}
    </div>
  );
}
```

Create `src/components/AccountBar.jsx`:

```jsx
import AccountMenu from "./AccountMenu";

// The one top bar for every signed-in screen in the hub and club area: logo, My clubs, account chip.
// `active` highlights My clubs (true on the hub screens, false inside a club).
export default function AccountBar({ active, name, email, onSignOut, navigate }) {
  const toHub = (e) => { e.preventDefault(); navigate("/"); };
  return (
    <header className="acct-bar">
      <div className="acct-bar-in">
        <a className="acct-brand" href="/" onClick={toHub}>
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </a>
        <nav aria-label="Account">
          <a href="/" className={active ? "active" : ""} aria-current={active ? "page" : undefined} onClick={toHub}>My clubs</a>
        </nav>
        <AccountMenu name={name} email={email} onSignOut={onSignOut} navigate={navigate} />
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Replace `src/clubs.css`**

Overwrite the file with exactly this (it keeps the form and settings rules that already exist and drops the old club title/action rules):

```css
/* Styles for the hub and club screens: one bar, one page frame, club header and tabs, forms.
   Scoped to .acct-shell so the queue app, public page and Live Board are untouched. Tokens only. */
.acct-shell{--page-max:1000px;--page-gutter:clamp(16px,4vw,40px);--card-line:light-dark(var(--line),var(--line-strong))}

/* ---- Frame: the bar and the page share the same left and right edges ---- */
.acct-bar{display:block;padding:10px var(--page-gutter)}
.acct-bar-in{display:flex;align-items:center;gap:clamp(10px,3vw,24px);max-width:calc(var(--page-max) - 2 * var(--page-gutter));margin:0 auto}
.acct-bar-in nav{order:0;width:auto;margin-right:auto}
.acct-main{max-width:var(--page-max);padding-left:var(--page-gutter);padding-right:var(--page-gutter)}
.page-narrow{max-width:720px}
.acct-shell a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}

/* ---- Page title ---- */
.page-title{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px 16px;margin:0 0 22px}
.page-title h1{margin:0;font:700 28px/1.15 "Space Grotesk";letter-spacing:-.5px;overflow-wrap:anywhere}
.page-title p{margin:6px 0 0;color:var(--muted);font-size:14px}
.page-title-actions{display:flex;flex-wrap:wrap;gap:8px}
.club-section{margin:0 0 6px;font:700 16px "Space Grotesk"}
.acct-main .club-section{margin:22px 0 10px}

/* ---- Buttons: primary is solid accent, outline is neutral (also when it is a link), danger is red ---- */
.acct-shell .outline{color:var(--ink)}
.acct-shell a.primary,.acct-shell a.outline{text-decoration:none}
.acct-shell .primary svg,.acct-shell .outline svg{flex-shrink:0}

/* ---- Cards and panels keep a visible border in dark mode ---- */
.acct-shell .panel,.acct-shell .hub-card,.acct-shell .hub-row{border-color:var(--card-line)}
.panel-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin:0 0 6px}
.panel-row .club-section{margin:0}
.acct-shell .empty{padding:18px 12px}

/* ---- Club header and tabs ---- */
.club-head{margin:0 0 14px}
.club-head.solo{margin-bottom:22px}
.club-head-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
.club-head h1{margin:0;font:700 28px/1.15 "Space Grotesk";letter-spacing:-.5px;overflow-wrap:anywhere}
.club-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.club-location{display:flex;align-items:center;gap:4px;margin:8px 0 0;color:var(--muted);font-size:13px}
.club-about{margin:6px 0 0;color:var(--ink-2);max-width:62ch;line-height:1.55;overflow-wrap:anywhere}
.club-tabs{display:flex;gap:4px;margin:0 0 22px;overflow-x:auto;box-shadow:inset 0 -1px 0 var(--card-line)}
.club-tabs a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;border-bottom:2px solid transparent;color:var(--ink-2);font-weight:700;font-size:13.5px;text-decoration:none;white-space:nowrap}
.club-tabs a:hover{color:var(--ink)}
.club-tabs a[aria-current="page"]{color:var(--accent-ink);border-bottom-color:var(--accent)}

/* ---- Hub ---- */
.hub-grid{grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.hub-card .pill{padding:4px 9px;color:var(--accent-ink);font-size:11px}
.hub-card-new{justify-content:center;border-style:dashed;background:transparent;box-shadow:none}
.hub-card-new b{font-size:15px}
.hub-start{display:grid;gap:8px;justify-items:start;padding:22px}
.hub-start b{font:700 17px "Space Grotesk"}
.hub-start p{margin:0 0 6px;color:var(--muted);max-width:52ch;line-height:1.5}
.hub-empty{margin:8px 0 0;color:var(--muted);font-size:13.5px}
.hub-row{display:flex;align-items:center;gap:12px;margin-top:22px;padding:14px 18px;border:1px solid var(--card-line);border-radius:15px;background:var(--panel);color:var(--ink);text-decoration:none;transition:border-color .15s ease,background .15s ease}
.hub-row:hover{border-color:var(--accent-line);background:var(--hover)}
.hub-row>svg:first-child{color:var(--accent-2);flex-shrink:0}
.hub-row>svg:last-child{color:var(--faint);flex-shrink:0}
.hub-row-copy{display:grid;gap:2px;flex:1}
.hub-row-copy b{font:700 15px "Space Grotesk"}
.hub-row-copy span{color:var(--muted);font-size:13px}

/* ---- Forms and settings ---- */
.club-form{display:grid;gap:14px;max-width:560px}
.club-form label{display:grid;gap:6px;font-weight:700;font-size:13px}
.club-form small{color:var(--muted);font-weight:500}
.club-form input,.club-form textarea,.club-input{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink)}
.club-form textarea,textarea.club-input{resize:vertical}
.club-save{display:flex;justify-content:flex-end;padding:10px 4px 2px}
.acct-main > form.account-group{margin-bottom:22px}

/* ---- Phone ---- */
@media (max-width:760px){
  .acct-main > form.account-group{margin-bottom:16px}
}
@media (max-width:560px){
  .acct-bar-in .account-menu-trigger-copy,.acct-bar-in .account-menu-chevron{display:none}
  .acct-bar-in .account-menu-trigger{padding:4px}
  .page-title h1,.club-head h1{font-size:24px}
}
```

- [ ] **Step 6: Verify and commit**

Run: `node src/utils/clubs.check.mjs && npx vite build`
Expected: `clubs.check: ok`, build succeeds (nothing imports the new components yet). Then `git checkout -- dist && git clean -fdq dist`.

```bash
git add src/components/AccountBar.jsx src/components/PageTitle.jsx src/utils/clubs.js src/utils/clubs.check.mjs src/clubs.css
git commit -m "feat: shared top bar, page title and page-frame styles for the hub and club screens" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Club shell, overview and open play list

**Files:**
- Modify: `src/ClubApp.jsx`, `src/views/ClubHome.jsx`, `src/views/Host.jsx`

**Interfaces:**
- Consumes: Task 1 (`AccountBar`, `PageTitle`, `ROLE_LABEL`, the CSS classes).
- Produces: `<ClubHome canManage events fallbackZone base navigate onNew />` (the `club` and `role` props are gone); `<Host ...>` unchanged props.

- [ ] **Step 1: New `ClubHome`**

Replace the whole of `src/views/ClubHome.jsx` with:

```jsx
import { CalendarPlus } from "lucide-react";
import DateTile from "../components/DateTile";
import { byStart, endHM, isListed } from "../utils/bookings";
import { formatHM, money } from "../utils/format";

// The club overview: upcoming open play. The club's name, role and tabs come from the club header
// in ClubApp. Managers get one primary action; members just see the list.
export default function ClubHome({ canManage, events, fallbackZone, base, navigate, onNew }) {
  const upcoming = events.filter((e) => isListed(e, fallbackZone)).sort(byStart);
  const go = (to) => (ev) => { ev.preventDefault(); navigate(to); };
  return (
    <div className="panel">
      <div className="panel-row">
        <h2 className="club-section">Upcoming open play</h2>
        {canManage && <button className="primary" onClick={onNew}><CalendarPlus size={15} /> New open play</button>}
      </div>
      {upcoming.map((e) => {
        const row = (
          <>
            <DateTile date={e.date} />
            <div className="booking-main">
              <b>{e.title}</b>
              <small>
                {formatHM(e.startTime)} – {formatHM(endHM(e))}
                {e.level && e.level !== "Any Level" ? ` · ${e.level}` : ""}
                {e.fee ? ` · ${money(e.fee)}` : " · Free"}
              </small>
            </div>
          </>
        );
        return canManage ? (
          <a key={e.id} className="booking-head event-row" href={`${base}/event/${e.id}`} onClick={go(`${base}/event/${e.id}`)}>{row}</a>
        ) : (
          <div key={e.id} className="booking-head">{row}</div>
        );
      })}
      {!upcoming.length && (
        <div className="empty">
          {canManage ? "No open play scheduled. Use New open play to start taking bookings." : "No open play scheduled yet."}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Club shell: header, tabs, shared bar**

Write `C:/Users/ADMINI~1/AppData/Local/Temp/claude/d--My-files--L-pickleball-MIXER-courtflow-react-firebase/3be4138f-3b25-43bb-a392-acb605e70b7a/scratchpad/ui-clubapp.cjs` (any scratchpad path works):

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

edit("src/ClubApp.jsx", [
  ['import { ArrowLeft } from "lucide-react";', 'import { ArrowLeft, MapPin } from "lucide-react";'],
  ['import AccountMenu from "./components/AccountMenu";', 'import AccountBar from "./components/AccountBar";'],
  ['import { clubPath } from "./utils/clubs";', 'import { ROLE_LABEL, clubPath } from "./utils/clubs";'],
  ["return <ClubHome club={club} role={role} canManage={canManage} events={events} fallbackZone={fallbackZone} base={base} navigate={navigate} />;",
   'return <ClubHome canManage={canManage} events={events} fallbackZone={fallbackZone} base={base} navigate={navigate} onNew={() => setEventModal("new")} />;'],
  [`  const navClass = (...routes) => (routes.includes(route) ? "active" : "");

  return (
    <div className="acct-shell club-shell">
      <header className="acct-bar">
        <a className="acct-brand" href="/" onClick={toHub}>
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </a>
        <nav aria-label="Club">
          <a href={base} className={navClass("club")} onClick={go(base)}>{club.name}</a>
          {canManage && <a href={\`\${base}/host\`} className={navClass("club-host", "club-event")} onClick={go(\`\${base}/host\`)}>Open play</a>}
          {canManage && <a href={\`\${base}/settings\`} className={navClass("club-settings")} onClick={go(\`\${base}/settings\`)}>Settings</a>}
          <a href="/" onClick={toHub}>My clubs</a>
        </nav>
        <AccountMenu
          name={acct.account?.name || acct.account?.clubName}
          email={acct.user?.email}
          onSignOut={acct.signOutUser}
          navigate={navigate}
        />
      </header>
      <main className="acct-main">{screen()}</main>`,
`  // One tab per club screen; the event page keeps "Open play" active.
  const tab = (to, label, ...routes) => (
    <a href={to} aria-current={routes.includes(route) ? "page" : undefined} onClick={go(to)}>{label}</a>
  );

  return (
    <div className="acct-shell club-shell">
      <AccountBar
        active={false} name={acct.account?.name || acct.account?.clubName} email={acct.user?.email}
        onSignOut={acct.signOutUser} navigate={navigate}
      />
      <main className="acct-main">
        <section className={\`club-head\${canManage ? "" : " solo"}\`}>
          <div className="club-head-top">
            <h1>{club.name}</h1>
            <div className="club-meta">
              {role && <span className="pill">{ROLE_LABEL[role]}</span>}
              <span className="pill off">{club.visibility === "public" ? "Public club" : "Private club"}</span>
            </div>
          </div>
          {route === "club" && club.location && <p className="club-location"><MapPin size={13} /> {club.location}</p>}
          {route === "club" && club.description && <p className="club-about">{club.description}</p>}
        </section>
        {canManage && (
          <nav className="club-tabs" aria-label="Club">
            {tab(base, "Overview", "club")}
            {tab(\`\${base}/host\`, "Open play", "club-host", "club-event")}
            {tab(\`\${base}/settings\`, "Settings", "club-settings")}
          </nav>
        )}
        {screen()}
      </main>`],
]);
console.log("ClubApp edited");
```

Run: `node <that file>` then `grep -n "AccountMenu\|navClass" src/ClubApp.jsx`
Expected: `ClubApp edited`, and the grep prints nothing.

- [ ] **Step 3: Open play list: title, actions, compact empty state**

Write and run `ui-host.cjs` (same `edit` helper as above, plus an import inserter):

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
const f = "src/views/Host.jsx";
let s = fs.readFileSync(f, "utf8");
const crlf = s.includes("\r\n");
s = s.split("\r\n").join("\n");
const i = s.lastIndexOf("\nimport ");
const end = s.indexOf("\n", i + 1);
s = s.slice(0, end) + '\nimport PageTitle from "../components/PageTitle";' + s.slice(end);
fs.writeFileSync(f, crlf ? s.split("\n").join("\r\n") : s);

edit(f, [
  [`      <h1>Host open play</h1>
      <p>Schedule a session, take bookings, and record who has paid.</p>
      <div className="panel">
        <PanelHead title="Upcoming" sub="Open an event to manage players, payments and join requests." />
        <div className="booking-toolbar">
          <button className="outline" onClick={onPlayNow}><Play size={15} /> Play now</button>
          <button className="primary" onClick={onNew}><CalendarPlus size={15} /> New open play</button>
          <button className="outline" onClick={onShare}><Share2 size={15} /> Share booking page</button>
        </div>
        {upcoming.map(row)}
        {!upcoming.length && <div className="empty">No open play scheduled. Create one to start taking bookings.</div>}`,
`      <PageTitle title="Open play" sub="Schedule a session, take bookings, and record who has paid.">
        <button className="outline" onClick={onPlayNow}><Play size={15} /> Play now</button>
        <button className="outline" onClick={onShare}><Share2 size={15} /> Share booking page</button>
        <button className="primary" onClick={onNew}><CalendarPlus size={15} /> New open play</button>
      </PageTitle>
      <div className="panel">
        <PanelHead title="Upcoming" sub="Open an event to manage players, payments and join requests." />
        {upcoming.map(row)}
        {!upcoming.length && <div className="empty">No open play scheduled. Use New open play to start taking bookings.</div>}`],
]);
console.log("Host edited");
```

Run it, then `grep -n "^import" src/views/Host.jsx`
Expected: `Host edited`; the import list shows the `PageTitle` import once.

- [ ] **Step 4: Verify and commit**

Run: `npx vite build`
Expected: succeeds. Then `git checkout -- dist && git clean -fdq dist`.
Run: `grep -rn "booking-toolbar\|club-actions\|club-title" src --include=*.jsx`
Expected: no output (the toolbar/old club classes are no longer used by any screen).

```bash
git add src/ClubApp.jsx src/views/ClubHome.jsx src/views/Host.jsx
git commit -m "feat: club header with tabs, shared top bar, one primary action per club screen" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Hub, create club, profile, club settings

**Files:**
- Modify: `src/AccountApp.jsx`, `src/views/Hub.jsx`, `src/views/CreateClub.jsx`, `src/views/Profile.jsx`, `src/views/ClubSettings.jsx`

**Interfaces:**
- Consumes: Task 1 (`AccountBar`, `PageTitle`, `ROLE_LABEL`, classes `page-narrow`, `hub-start`, `hub-row`, `hub-card-new`, `hub-empty`).
- Produces: unchanged component props (`Hub name clubs ready navigate`, `CreateClub onCreate navigate`, `Profile acct onDelete`, `ClubSettings club isOwner notify onUpdate onDelete`).

- [ ] **Step 1: New `Hub`**

Replace the whole of `src/views/Hub.jsx` with:

```jsx
import { ChevronRight, ListOrdered, Plus, Users } from "lucide-react";
import PageTitle from "../components/PageTitle";
import { ROLE_LABEL } from "../utils/clubs";

// The home screen: your clubs first, a smaller card to create another, and the quick session.
// Profile lives in the account menu, so it is not repeated here.
export default function Hub({ name, clubs, ready, navigate }) {
  const to = (path) => (e) => { e.preventDefault(); navigate(path); };
  return (
    <>
      <PageTitle title={name ? `Hi, ${name}` : "Your clubs"} sub="Pick a club to manage or visit, or start one of your own." />

      <h2 className="club-section">Your clubs</h2>
      {!ready ? (
        <p className="hub-empty">Loading your clubs…</p>
      ) : clubs.length === 0 ? (
        <div className="panel hub-start">
          <b>Create your first club</b>
          <p>A club holds your open play, games and settings. You'll be its owner.</p>
          <a className="primary" href="/clubs/new" onClick={to("/clubs/new")}><Plus size={15} /> Create a club</a>
        </div>
      ) : (
        <div className="hub-grid">
          {clubs.map((c) => (
            <a key={c.id} className="hub-card" href={`/clubs/${c.id}`} onClick={to(`/clubs/${c.id}`)}>
              <Users size={22} />
              <b>{c.clubName}</b>
              <span className="pill">{ROLE_LABEL[c.role] || ROLE_LABEL.member}</span>
            </a>
          ))}
          <a className="hub-card hub-card-new" href="/clubs/new" onClick={to("/clubs/new")}>
            <Plus size={22} />
            <b>Create a club</b>
          </a>
        </div>
      )}

      <a className="hub-row" href="/club">
        <ListOrdered size={22} />
        <span className="hub-row-copy">
          <b>Quick session</b>
          <span>Run the queue right now, no club needed. Saved on this device.</span>
        </span>
        <ChevronRight size={18} />
      </a>
    </>
  );
}
```

- [ ] **Step 2: Shared bar in `AccountApp`; titles and narrow forms in the other screens**

Write and run `ui-account.cjs` (same `edit` helper as in Task 2):

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

edit("src/AccountApp.jsx", [
  ['import AccountMenu from "./components/AccountMenu";', 'import AccountBar from "./components/AccountBar";'],
  ['  const go = (to) => (e) => { e.preventDefault(); navigate(to); };\n', ""],
  [`      <header className="acct-bar">
        <a className="acct-brand" href="/" onClick={go("/")}>
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </a>
        <nav aria-label="Account">
          <a href="/" className={route === "hub" || route === "clubs" ? "active" : ""} onClick={go("/")}>My clubs</a>
        </nav>
        <AccountMenu name={name} email={acct.user?.email} onSignOut={acct.signOutUser} navigate={navigate} />
      </header>`,
`      <AccountBar
        active={route === "hub" || route === "clubs"} name={name} email={acct.user?.email}
        onSignOut={acct.signOutUser} navigate={navigate}
      />`],
]);

edit("src/views/CreateClub.jsx", [
  ['import Select from "../components/Select";', 'import PageTitle from "../components/PageTitle";\nimport Select from "../components/Select";'],
  ['    <>\n      <a className="back-link"', '    <div className="page-narrow">\n      <a className="back-link"'],
  [`      <h1>Create a club</h1>
      <p>You'll be the owner. You can change everything later in the club's settings.</p>`,
   `      <PageTitle title="Create a club" sub="You'll be the owner. You can change everything later in the club's settings." />`],
  ["      </form>\n    </>\n  );\n}", "      </form>\n    </div>\n  );\n}"],
]);

edit("src/views/Profile.jsx", [
  ['import Select from "../components/Select";', 'import PageTitle from "../components/PageTitle";\nimport Select from "../components/Select";'],
  ['  return (\n    <div className="account-groups">', '  return (\n    <div className="page-narrow">\n      <PageTitle title="Profile" sub="Your name, sign-in and appearance." />\n      <div className="account-groups">'],
  ["      )}\n    </div>\n  );\n}", "      )}\n      </div>\n    </div>\n  );\n}"],
]);

edit("src/views/ClubSettings.jsx", [
  ['import DeleteAccountDialog from "../components/DeleteAccountDialog";', 'import DeleteAccountDialog from "../components/DeleteAccountDialog";\nimport PageTitle from "../components/PageTitle";'],
  ["  return (\n    <>\n      <ClubProfileSettings", '  return (\n    <div className="page-narrow">\n      <PageTitle title="Settings" sub="These apply to this club only." />\n      <ClubProfileSettings'],
  ["      )}\n    </>\n  );\n}", "      )}\n    </div>\n  );\n}"],
]);
console.log("account screens edited");
```

Run it, then: `grep -n "go(" src/AccountApp.jsx`
Expected: `account screens edited`; the grep prints nothing (the unused `go` helper is gone).

- [ ] **Step 3: Verify and commit**

Run: `npx vite build`
Expected: succeeds. Then `git checkout -- dist && git clean -fdq dist`.
Run: `grep -rn "<h1" src/views/Hub.jsx src/views/CreateClub.jsx src/views/Profile.jsx src/views/ClubSettings.jsx src/views/Host.jsx src/views/ClubHome.jsx`
Expected: no output (every title now comes from `PageTitle` or the club header).

```bash
git add src/AccountApp.jsx src/views/Hub.jsx src/views/CreateClub.jsx src/views/Profile.jsx src/views/ClubSettings.jsx
git commit -m "feat: hub, create club, profile and club settings on the shared page frame" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Browser pass, fixes, docs

**Files:**
- Modify (only if a check fails): `src/clubs.css` and the view that is wrong
- Modify: `CLAUDE.md`

Run on the emulators: `npm run emulators` in the background, wait for "All emulators ready", then `npm run dev:emu`, open `http://localhost:5300/`. Playwright caveat: the custom Select menus close on any scroll event, so open and pick options with `page.evaluate(() => document.querySelector(...).click())`, not `locator.click()`. Overflow helper to run on every screen: `page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)` must be `false`.

- [ ] **Step 1: Desktop pass (1440 px, light)**

Sign up as "Alex Santos" (`alex@example.com`, password `secret12`). Check and screenshot (`browser_take_screenshot`, full page):
1. Hub with no clubs: one "Create your first club" panel, Quick session row below, no Profile card. Bar: logo left, "My clubs" active, account chip right; bar content lines up with the page content's left and right edges.
2. Create a club "Centro" (public, location "Manila", description). Landing on the club: header with name + Owner + Public club, location and description, tabs Overview / Open play / Settings with Overview underlined, one green "New open play" button, neutral outline everywhere else, no purple text.
3. Open play tab: title "Open play", actions Play now + Share booking page (outline) and New open play (green) on the right; empty state is one short line.
4. Create an open play, add 4 players, open the event page: "Open play" tab stays underlined; back link works.
5. Settings tab: title "Settings", forms at 720 px width, left aligned; hub card for Centro shows name + Owner pill, plus the smaller dashed "Create a club" card; grid cards fill the row.
6. Profile (from the account chip menu): title "Profile", forms narrow. Esc closes the menu and returns focus to the chip.
Fix anything that differs, in `src/clubs.css` first.

- [ ] **Step 2: Phone pass (390 and 360 px)**

`browser_resize` to 390x800, then 360x800. On hub, club overview, open play, event page, settings, create club, profile: overflow helper is `false`; the account chip shows only its icon; page actions wrap below the title; the tab strip is fully reachable (scrolls sideways if needed); every control is at least 44 px tall (spot check tabs, buttons, chip). (Review Focus 2)

- [ ] **Step 3: Non-manager view**

In a second browser context (`browser.newContext()`) sign up "Sam" (`sam@example.com`) and open the club URL, `/host`, `/settings` and `/event/<id>` of Centro: the club page shows the header and the upcoming list with NO tab strip and NO New open play button; the three manager URLs show "This page is for the club's managers." with a back link and no controls. (Review Focus 1)

- [ ] **Step 4: Dark mode**

As Alex: Profile, Appearance, set Dark: hub cards and the Quick session row have visible borders, "Create a club" dashed card reads as secondary. Then in Centro Settings, Display, Theme, set Dark: the club header, tabs (active underline in accent), panels and event page are readable, borders visible. Check with `browser_take_screenshot`. (Review Focus 3)

- [ ] **Step 5: Long names**

Rename Centro (Settings) to a 60-character name with no spaces (`ABCDEFGHIJ` repeated 6 times) and set the account name to 40 characters: club header wraps without overflow, hub card shows the name without breaking the grid, the account chip ellipsizes, overflow helper `false` at 390 px. Rename back afterwards. (Review Focus 4)

- [ ] **Step 6: Hub states and keyboard**

Create 6 more clubs (7 total): the grid wraps cleanly, the dashed card is last. Reload the hub: while loading it shows "Loading your clubs…" and never the "Create your first club" panel. Delete the extra clubs afterwards from their Settings. Keyboard: from the top of a club page press Tab through the bar, the tabs and the page actions: every stop shows a visible focus ring, order matches the visual order. (Review Focus 5)

- [ ] **Step 7: Existing checks and docs**

Run: `node src/utils/clubs.check.mjs && node src/utils/route.check.mjs && node src/utils/paths.check.mjs && npm run test:rules && npx vite build`
Expected: all pass. Then `git checkout -- dist && git clean -fdq dist`. Stop the servers. `git clean -fdq .playwright-mcp`.

In `CLAUDE.md`, directly after the "Clubs (part A ..." bullet, add:

```md
- Hub and club screens share one frame (`docs/superpowers/specs/2026-10-08-account-club-ui-design.md`): `AccountBar` (logo, My clubs, account chip) on every screen, `PageTitle` for titles and page actions, a club header + tab strip (Overview, Open play, Settings) in `ClubApp`, forms capped with `.page-narrow`. Styles for all of it live in `src/clubs.css` under `.acct-shell` (never in `styles.css`), so the queue app, public page and Live Board stay unchanged. Neutral buttons are `.outline` (ink text, also for links); `.primary` once per screen region.
```

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md src/clubs.css
git commit -m "docs: record the shared hub and club frame; browser pass fixes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
(If a check in steps 1 to 6 needed a view change, add that view's path to the `git add` too.)

---

## Self-review

**Spec coverage:** one top bar, aligned to content (Task 1 `AccountBar`, `.acct-bar-in`); page frame, one title style, narrow forms (Task 1 CSS, Tasks 2 and 3 `PageTitle`, `.page-narrow`); club header and tabs, duplicate buttons removed, members see no tabs (Task 2); hub with club cards, dashed create card, first-club call to action, slim Quick session row, Profile removed from the hub (Task 3); button rules including the purple link fix, dark-mode card borders scoped to `.acct-shell`, compact empty states (Task 1 CSS, Tasks 2 and 3); phone and accessibility (Task 1 CSS, Task 4 checks); `AccountLogin` is not changed: the sign-in screen is a standalone centred card outside `.acct-shell` and already uses the same card tokens (Task 4 step 1 screenshots would show if it needs work). **Deviation from the spec:** the spec says empty states carry the fixing action inline; here the Open play list and the overview name the action in text ("Use New open play ...") because the primary button is already on screen in the title row or panel header, so a second button would duplicate it.

**Placeholder scan:** none; every code step has full code or exact replacement strings, and every check lists exact conditions.

**Type consistency:** `ROLE_LABEL` (Task 1) is imported by `ClubApp` (Task 2) and `Hub` (Task 3). `AccountBar` props (`active, name, email, onSignOut, navigate`) match both call sites. `PageTitle` takes `title`, `sub`, children everywhere. `ClubHome` props in Task 2 step 1 match the call in step 2 (`canManage events fallbackZone base navigate onNew`).

**Review Focus coverage:** 1 to 5 map to Task 4 steps 3, 2, 4, 5, 6.
