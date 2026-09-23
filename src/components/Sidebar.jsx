import {
  LayoutDashboard, ListOrdered, Users, Trophy, Plus, Pencil, CircleDot, X,
  PanelLeftClose, PanelLeftOpen, LogOut, Flag, Receipt, BookOpen,
} from "lucide-react";
import { NAV_ITEMS } from "../data/constants";
import ModeSelect from "./ModeSelect";

const ICONS = {
  dashboard: LayoutDashboard,
  queue: ListOrdered,
  players: Users,
  cost: Receipt,
  stats: Trophy,
  guide: BookOpen,
};

function Nav({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`nav ${active ? "active" : ""}`} title={label}>
      <Icon />
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({
  session, courtCount, mode, onChangeMode, tab, onSelectTab, onNewSession, onEditSession,
  onEndSession, onSwitchClub,
  open, onClose, collapsed, onToggleCollapse,
}) {
  return (
    <>
      <div className={`overlay ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <img className="mark" src="/images/courtflow.png" alt="" />
            <img className="wordmark-whole" src="/images/name whole.png" alt="CourtFlow — Pickleball Queue" />
          </div>
          <button className="icon sidebar-close" onClick={onClose} aria-label="Close menu"><X /></button>
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

        <div className="sidebar-bottom">
          <div className="session">
            <CircleDot size={13} />
            <div><b>{session.location}</b><small>{courtCount} {courtCount === 1 ? "court" : "courts"} · {session.format}</small></div>
            <button className="icon session-edit" title="Edit session" onClick={onEditSession}><Pencil size={12} /></button>
          </div>

          <ModeSelect mode={mode} onChange={onChangeMode} />

          <div className="sidefoot">
            <button className="outline dark" onClick={onNewSession} title="New Session">
              <Plus /> <span>New Session</span>
            </button>
            <button className="sidebar-endsession" onClick={onEndSession} title="End Session">
              <Flag /> <span>End Session</span>
            </button>
            <button className="outline dark" onClick={onSwitchClub} title="Switch Club">
              <LogOut /> <span>Switch Club</span>
            </button>
            <button
              className="outline dark sidebar-collapse-btn"
              onClick={onToggleCollapse}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              <span>Collapse</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
