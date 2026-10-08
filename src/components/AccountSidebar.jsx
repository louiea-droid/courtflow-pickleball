import { useEffect, useState } from "react";
import { Menu, Plus, Search, ListOrdered, Users, X } from "lucide-react";
import AccountMenu from "./AccountMenu";
import { clubPath } from "../utils/clubs";

// The one sidebar for every signed-in screen in the hub and club area (a drawer behind a menu button on
// phones). Sections: Play (find a club, quick session), Your clubs (the open club expands in place to its
// screens: `club` = { id, name, tabs: [{ to, label, Icon, current, badge, badgeText }] }; then a way to
// join another), Manage (create a club). The brand goes to the hub; the account menu is at the bottom.
// `active` highlights a place: "find" | "new".
export default function AccountSidebar({ active, name, email, onSignOut, navigate, clubs = [], club = null }) {
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
      <Icon size={17} /><span>{label}</span>{extra}
    </a>
  );
  // Your clubs, with the open club expanded in place to its screens (a club the person isn't in yet, such as a
  // public one opened from Find a club, still shows as the open one).
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
          <section className="acct-side-group" aria-label="Play">
            <p className="acct-side-label">Play</p>
            <nav aria-label="Play">
              {link("/clubs/find", "Find a club", Search, active === "find")}
              <a className="acct-link" href="/club"><ListOrdered size={17} /><span>Quick session</span></a>
            </nav>
          </section>
          <section className="acct-side-group" aria-label="Your clubs">
            <p className="acct-side-label">Your clubs</p>
            <nav aria-label="Your clubs">
              {list.map((c) => (c.id === club?.id ? (
                <div className="acct-side-open" key={c.id}>
                  <p className="acct-side-name"><Users size={17} /><span>{c.clubName}</span></p>
                  {club.tabs.length > 0 && (
                    <div className="acct-side-sub">
                      {club.tabs.map((t) => link(t.to, t.label, t.Icon, t.current, t.badge ? (
                        <><span className="count-badge">{t.badge}</span><span className="sr-only"> {t.badgeText}</span></>
                      ) : null))}
                    </div>
                  )}
                </div>
              ) : link(clubPath(c.id), c.clubName, Users, false)))}
              {link("/clubs/find", "Join another club", Plus, false)}
            </nav>
          </section>
          <section className="acct-side-group" aria-label="Manage">
            <p className="acct-side-label">Manage</p>
            <nav aria-label="Manage">
              {link("/clubs/new", "Create a club", Plus, active === "new")}
            </nav>
          </section>
        </div>
        <AccountMenu name={name} email={email} onSignOut={onSignOut} navigate={navigate} />
      </aside>
    </>
  );
}
