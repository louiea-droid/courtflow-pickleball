import { useEffect, useState } from "react";
import { Building2, CalendarSearch, CircleHelp, House, Menu, MessageSquare, PanelLeft, UserPlus, Users, X } from "lucide-react";
import AccountMenu from "./AccountMenu";
import NotificationBell from "./NotificationBell";
import { clubPath } from "../utils/clubs";

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
  const link = (to, label, Icon, current, extra, selected = false) => (
    <a key={to} className={`acct-link${selected ? " selected-club" : ""}`} href={to} title={label} aria-current={current ? "page" : undefined} onClick={go(to)}>
      {Icon && <Icon size={17} />}<span>{label}</span>{extra}
    </a>
  );
  // Your clubs, with the open club listed even if they have not joined it (for example, a public club page).
  const list = club && !clubs.some((c) => c.id === club.id) ? [{ id: club.id, clubName: club.name }, ...clubs] : clubs;

  return (
    <>
      <header className="acct-topbar">
        <button className="acct-menu-btn acct-open" type="button" aria-label="Open menu" aria-expanded={open} aria-controls="acct-side" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>
        <a className="acct-brand" href="/" onClick={go("/")}><img src="/images/courtwave.png" alt="" /><b>CourtWave</b></a>
        {headerAction}
        {notifications && <NotificationBell items={notifications} navigate={navigate} />}
        <AccountMenu name={name} email={email} onSignOut={onSignOut} navigate={navigate} settingsPath={settingsPath} />
      </header>
      <div className={`overlay${open ? " show" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`acct-side${open ? " open" : ""}`} id="acct-side">
        <div className="acct-side-top">
          {/* On a wide screen the logo collapses and expands the sidebar (Home is the first link); the drawer on a phone hides it */}
          <button className="acct-brand" type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((c) => !c)}><img src="/images/courtwave.png" alt="" /><b>CourtWave</b></button>
          <button className="acct-menu-btn acct-side-close" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="acct-side-scroll">
          <nav aria-label="Home">
            {link("/", "Home", House, active === "hub")}
          </nav>
          <section className="acct-side-group" aria-label="Play">
            <p className="acct-side-label">Play</p>
            <nav aria-label="Play">
              {link("/sessions", "Find session", CalendarSearch, active === "sessions")}
              {link("/clubs/find", "Clubs", Building2, active === "find")}
              {link("/friends", "Friends", UserPlus, active === "friends", friendRequests > 0 ? (
                <><span className="count-badge">{friendRequests}</span><span className="sr-only"> friend requests waiting</span></>
              ) : null)}
              {link("/inbox", "Inbox", MessageSquare, active === "inbox", inboxUnread > 0 ? (
                <><span className="count-badge">{inboxUnread}</span><span className="sr-only"> unread chats</span></>
              ) : null)}
            </nav>
          </section>
          {/* My clubs exists once the person has a club (joined, managing, or one they just opened) */}
          {list.length > 0 && (
          <nav className="acct-side-group" aria-label="My clubs">
            {link("/clubs", "My clubs", Users, active === "clubs")}
            {list.length > 0 && (
              <div className="acct-side-sub">
                {list.map((c) => (c.id === club?.id ? (
                  <div className="acct-side-open" key={c.id}>
                    {link(clubPath(c.id), c.clubName, null, c.id === club?.id && club.current, null, c.id === club?.id)}
                  </div>
                ) : link(clubPath(c.id), c.clubName, null, false)))}
              </div>
            )}
          </nav>
          )}
        </div>
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
