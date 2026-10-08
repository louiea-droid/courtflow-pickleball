import { useEffect, useState } from "react";
import { Menu, Plus, Search, ListOrdered, Users, X } from "lucide-react";
import AccountMenu from "./AccountMenu";
import { clubPath } from "../utils/clubs";

// The one sidebar for every signed-in screen in the hub and club area (a drawer behind a menu button on
// phones). Top: brand and the places everyone has. Middle: when a club is open, its name and screens
// (`club` = { id, name, tabs: [{ to, label, Icon, current, badge, badgeText }] }); then the person's
// other clubs. Bottom: the account menu. `active` highlights a top-level place: "hub" | "find" | "new".
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
  const others = clubs.filter((c) => c.id !== club?.id);

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
          <nav aria-label="CourtFlow">
            {link("/", "My clubs", Users, active === "hub")}
            {link("/clubs/find", "Find a club", Search, active === "find")}
            {link("/clubs/new", "Create a club", Plus, active === "new")}
            <a className="acct-link" href="/club"><ListOrdered size={17} /><span>Quick session</span></a>
          </nav>
          {club && (
            <section className="acct-side-group" aria-label={club.name}>
              <p className="acct-side-name">{club.name}</p>
              {club.tabs.length > 0 && (
                <nav aria-label="Club">
                  {club.tabs.map((t) => link(t.to, t.label, t.Icon, t.current, t.badge ? (
                    <><span className="count-badge">{t.badge}</span><span className="sr-only"> {t.badgeText}</span></>
                  ) : null))}
                </nav>
              )}
            </section>
          )}
          {others.length > 0 && (
            <section className="acct-side-group" aria-label="Your clubs">
              <p className="acct-side-label">Your clubs</p>
              <nav aria-label="Your clubs">
                {others.map((c) => link(clubPath(c.id), c.clubName, Users, false))}
              </nav>
            </section>
          )}
        </div>
        <AccountMenu name={name} email={email} onSignOut={onSignOut} navigate={navigate} />
      </aside>
    </>
  );
}
