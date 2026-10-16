import {
  LayoutDashboard, ListOrdered, Users, Trophy, Settings, CircleDot, X,
  PanelLeftClose, PanelLeftOpen, Flag, Receipt, BookOpen, ArrowLeft,
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
  settings: Settings,
};

function Nav({ icon: Icon, label, active, onClick, tourKey }) {
  return (
    <button onClick={onClick} className={`nav ${active ? "active" : ""}`} title={label} data-tour={`nav-${tourKey}`}>
      <Icon />
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({
  session, courtCount, mode, onChangeMode, tab, onSelectTab,
  onEndSession, endLabel = "End Session", hiddenTabs = [], backLink = null,
  open, onClose, collapsed, onToggleCollapse,
}) {
  return (
    <>
      <div className={`overlay ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <img className="mark" src="/images/courtwave.png" alt="" />
            <span className="wordmark-whole">Court<span>Wave</span></span>
          </div>
          <button className="icon sidebar-close" onClick={onClose} aria-label="Close menu"><X /></button>
        </div>

        <nav>
          {NAV_ITEMS.filter((item) => !hiddenTabs.includes(item.key)).map((item) => (
            <Nav
              key={item.key} tourKey={item.key}
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
          </div>

          <ModeSelect mode={mode} onChange={onChangeMode} />

          <div className="sidefoot">
            {backLink && (
              <button className="outline dark" onClick={backLink.onClick} title={backLink.label}>
                <ArrowLeft /> <span>{backLink.label}</span>
              </button>
            )}
            <button className="sidebar-endsession" data-tour="end" onClick={onEndSession} title={endLabel}>
              <Flag /> <span>{endLabel}</span>
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
