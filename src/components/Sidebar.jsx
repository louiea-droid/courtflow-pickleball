import { LayoutDashboard, ListOrdered, Users, Trophy, Plus, CircleDot, X } from "lucide-react";
import { NAV_ITEMS } from "../data/constants";

const ICONS = {
  dashboard: LayoutDashboard,
  queue: ListOrdered,
  players: Users,
  stats: Trophy,
};

function Nav({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`nav ${active ? "active" : ""}`}>
      <Icon />
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({ session, tab, onSelectTab, onNewSession, open, onClose }) {
  return (
    <>
      <div className={`overlay ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="mark">C</div>
            <div><b>CourtFlow</b><small>Pickleball Queue</small></div>
          </div>
          <button className="icon sidebar-close" onClick={onClose} aria-label="Close menu"><X /></button>
        </div>

        <div className="session">
          <CircleDot size={13} />
          <div><b>{session.location}</b><small>{session.courts} courts · {session.format}</small></div>
        </div>

        <nav>
          {NAV_ITEMS.map((item) => (
            <Nav
              key={item.key}
              icon={ICONS[item.key]}
              label={item.label}
              active={tab === item.key}
              onClick={() => onSelectTab(item.key)}
            />
          ))}
        </nav>

        <div className="sidefoot">
          <button className="outline dark" onClick={onNewSession}><Plus /> New Session</button>
        </div>
      </aside>
    </>
  );
}
