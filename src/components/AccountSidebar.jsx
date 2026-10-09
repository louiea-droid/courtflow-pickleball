import { useEffect, useState } from "react";
import { Building2, CalendarSearch, House, Menu, MessageSquare, UserPlus, Users, X } from "lucide-react";
import AccountMenu from "./AccountMenu";
import { clubPath } from "../utils/clubs";

// The one sidebar for every signed-in screen in the hub and club area (a drawer behind a menu button on
// phones). Home, Play (find a club, friends with a count of requests waiting, the inbox with a count of unread chats), My clubs (a link to the page of all your clubs, with the clubs listed under
// it; the open club expands in place to its screens: `club` = { id, name, tabs: [{ to, label, Icon, current,
// badge, badgeText }] }), and the account menu at the bottom. Creating a club and the quick session live on
// Home. `active` highlights a place: "hub" | "sessions" | "find" | "friends" | "inbox" | "clubs".
export default function AccountSidebar({ active, name, email, onSignOut, navigate, clubs = [], club = null, friendRequests = 0, inboxUnread = 0 }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (to) => (e) => { e.preventDefault(); setOpen(false); navigate(to); };
  const link = (to, label, Icon, current, extra) => (
    <a key={to} className="acct-link" href={to} aria-current={current ? "page" : undefined} onClick={go(to)}>
      {Icon && <Icon size={17} />}<span>{label}</span>{extra}
    </a>
  );
  // Your clubs, with the open club expanded in place to its screens (a club the person isn't in yet, such as a
  // public one opened from Clubs, still shows as the open one).
  const list = club && !clubs.some((c) => c.id === club.id) ? [{ id: club.id, clubName: club.name }, ...clubs] : clubs;

  return (
    <>
      <header className="acct-topbar">
        <button className="acct-menu-btn" type="button" aria-label="Open menu" aria-expanded={open} aria-controls="acct-side" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>
        <a className="acct-brand" href="/" onClick={go("/")}><img src="/images/courtflow.png" alt="" /><b>CourtFlow</b></a>
      </header>
      <div className={`overlay${open ? " show" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`acct-side${open ? " open" : ""}`} id="acct-side">
        <div className="acct-side-top">
          <a className="acct-brand" href="/" onClick={go("/")}><img src="/images/courtflow.png" alt="" /><b>CourtFlow</b></a>
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
                    <p className="acct-side-name"><span>{c.clubName}</span></p>
                    {club.tabs.length > 0 && (
                      <div className="acct-side-sub">
                        {club.tabs.map((t) => link(t.to, t.label, t.Icon, t.current, t.badge ? (
                          <><span className="count-badge">{t.badge}</span><span className="sr-only"> {t.badgeText}</span></>
                        ) : null))}
                      </div>
                    )}
                  </div>
                ) : link(clubPath(c.id), c.clubName, null, false)))}
              </div>
            )}
          </nav>
          )}
        </div>
        <AccountMenu name={name} email={email} onSignOut={onSignOut} navigate={navigate} />
      </aside>
    </>
  );
}
