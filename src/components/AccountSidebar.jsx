import { useEffect, useState } from "react";
import { Building2, CalendarSearch, CircleHelp, House, Menu, MessageSquare, PanelLeft, UserPlus, X } from "lucide-react";
import AccountMenu from "./AccountMenu";
import NotificationBell from "./NotificationBell";

import { clubPath } from "../utils/clubs";
import ClubBadge from "./ClubBadge";

// The one sidebar for every signed-in screen in the hub and club area (a drawer behind a menu button on
// phones). Home, Play (find a club, friends with a count of requests waiting, the inbox with a count of unread chats), My clubs (a link to the page of all your clubs, with the clubs listed under it; the open club links to its overview: `club` = { id, name, current }). The account menu lives in the sticky header across the top (with the button that collapses the
// sidebar to an icon rail on a wide screen; the choice is remembered). Creating a club and the quick session live on
// Home. `active` highlights a place: "hub" | "sessions" | "find" | "friends" | "inbox" | "clubs" | "help".
export default function AccountSidebar({ active, name, email, onSignOut, navigate, clubs = [], club = null, friendRequests = 0, inboxUnread = 0, headerAction = null, notifications = null, settingsPath = null }) {
  const [open, setOpen] = useState(false);
  // Wide screens: the sidebar is a fixed rail that can collapse to icons. A data attribute on <html> carries the state to the CSS.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("courtflow.sideCollapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    document.documentElement.dataset.acctSide = collapsed ? "collapsed" : "";
    try { localStorage.setItem("courtflow.sideCollapsed", collapsed ? "1" : "0"); } catch { /* private mode: it just won't be remembered */ }
    return () => { delete document.documentElement.dataset.acctSide; };
  }, [collapsed]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (to) => (e) => { e.preventDefault(); setOpen(false); navigate(to); };
  const link = (to, label, Icon, current, extra, selected = false, lead = null) => (
    <a key={to} className={`acct-link${selected ? " selected-club" : ""}`} href={to} title={label} aria-current={current ? "page" : undefined} onClick={go(to)}>
      {Icon && <Icon size={17} />}{lead}<span>{label}</span>{extra}
    </a>
  );
  // A club's colored initial, as on Home; it is also the club's icon when the sidebar is collapsed.
  const badge = (c) => <ClubBadge className="acct-club-badge" id={c.id} name={c.clubName} />;
  // Your clubs, with the open club listed even if they have not joined it (for example, a public club page).
  const list = club && !clubs.some((c) => c.id === club.id) ? [{ id: club.id, clubName: club.name }, ...clubs] : clubs;

  return (
    <>
      <header className="acct-topbar">
        <button className="acct-menu-btn acct-open" type="button" aria-label="Open menu" aria-expanded={open} aria-controls="acct-side" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>
        <a className="acct-brand" href="/" onClick={go("/")}><img src="/images/courtwave-light.png" alt="" /><b>CourtWave</b></a>
        {headerAction}
        {notifications && <NotificationBell items={notifications} navigate={navigate} />}
        <AccountMenu name={name} email={email} onSignOut={onSignOut} navigate={navigate} settingsPath={settingsPath} />
      </header>
      <div className={`overlay${open ? " show" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`acct-side${open ? " open" : ""}`} id="acct-side">
        <div className="acct-side-top">
          {/* On a wide screen the logo collapses and expands the sidebar (Home is the first link); the drawer on a phone hides it */}
          <button className="acct-brand" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((c) => !c)}><img src="/images/courtwave-light.png" alt="" /><b>CourtWave</b></button>
          <button className="acct-menu-btn acct-side-close" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="acct-side-scroll">
          <nav className="acct-side-group" aria-label="Main">
              {link("/", "Home", House, active === "hub")}
              {link("/sessions", "Find session", CalendarSearch, active === "sessions")}
              {link("/clubs/find", "Clubs", Building2, active === "find")}
              {link("/friends", "Friends", UserPlus, active === "friends", friendRequests > 0 ? (
                <><span className="count-badge">{friendRequests}</span><span className="sr-only"> friend requests waiting</span></>
              ) : null)}
              {link("/inbox", "Inbox", MessageSquare, active === "inbox", inboxUnread > 0 ? (
                <><span className="count-badge">{inboxUnread}</span><span className="sr-only"> unread chats</span></>
              ) : null)}
          </nav>
          {/* My clubs exists once the person has a club (joined, managing, or one they just opened) */}
          {list.length > 0 && (
          <nav className="acct-side-group" aria-label="My clubs">
            <div className="acct-side-head">
              <span>Your clubs</span>
              <a href="/clubs" aria-current={active === "clubs" ? "page" : undefined} onClick={go("/clubs")}>See all</a>
            </div>
            <div className="acct-side-sub">
              {list.map((c) => link(clubPath(c.id), c.clubName, null, c.id === club?.id && club.current, null, c.id === club?.id, badge(c)))}
            </div>
          </nav>
          )}
        </div>
        <svg className="acct-side-wave" viewBox="0 0 248 52" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 22 C50 6 96 34 150 16 S226 4 248 12 V52 H0Z" fill="var(--lime)" />
          <path d="M0 32 C56 16 104 44 160 26 S230 16 248 22 V52 H0Z" fill="var(--brand-green)" />
        </svg>
        <div className="acct-side-foot">
          {link("/help", "Help", CircleHelp, active === "help")}
          <button className="acct-collapse" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((c) => !c)}>
            <PanelLeft size={17} /><span>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
