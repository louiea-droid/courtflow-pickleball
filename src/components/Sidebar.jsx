import {
  LayoutDashboard, ListOrdered, Users, Trophy, Settings, CircleDot, X,
  PanelLeftClose, PanelLeftOpen, Flag, Receipt, BookOpen, ArrowLeft, Moon, Sun,
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

function Nav({ icon: Icon, label, active, onClick, tourKey, count = 0 }) {
  return (
    <button onClick={onClick} className={`nav ${active ? "active" : ""}`} title={label} data-tour={`nav-${tourKey}`}>
      <Icon />
      <span>{label}</span>
      {count > 0 && <em className="nav-count" aria-label={`${count} waiting`}>{count}</em>}
    </button>
  );
}

export default function Sidebar({
  session, courtCount, mode, onChangeMode, tab, onSelectTab,
  onEndSession, endLabel = "End Session", hiddenTabs = [], backLink = null,
  open, onClose, collapsed, onToggleCollapse, dark = false, onToggleTheme, onOpenSettings = null, live = false, queueCount = 0,
}) {
  return (
    <>
      <div className={`overlay ${open ? "show" : ""}`} onClick={onClose} />
      <aside className={`sidebar ${open ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <img className="mark" src="/images/courtwave-light.png" alt="" />
            <span className="wordmark-whole">Court<span>Wave</span></span>
          </div>
          <button className="icon sidebar-close" onClick={onClose} aria-label="Close menu"><X /></button>
        </div>

        {/* The game you are running, always in view: Live, its name, then courts, format and the mode (2026-11-13 redesign, option C). */}
        <div className="sidebar-game">
          <span className="sidebar-game-live"><CircleDot size={11} /> {live ? "Live" : "Session"}</span>
          <b>{session.location}</b>
          <div className="sidebar-game-chips">
            <span>{courtCount} {courtCount === 1 ? "court" : "courts"}</span>
            <span>{session.format}</span>
            <ModeSelect mode={mode} onChange={onChangeMode} />
          </div>
        </div>

        <nav>
          {NAV_ITEMS.filter((item) => !hiddenTabs.includes(item.key)).map((item) => (
            <Nav
              key={item.key} tourKey={item.key}
              icon={ICONS[item.key]}
              label={item.label}
              active={tab === item.key}
              onClick={() => onSelectTab(item.key)}
              count={item.key === "queue" ? queueCount : 0}
            />
          ))}
        </nav>

        <div className="sidefoot">
          <div className="sidebar-icons">
            <button className="outline dark" onClick={onToggleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
              {dark ? <Sun /> : <Moon />}
            </button>
            {onOpenSettings && (
              <button className="outline dark" onClick={onOpenSettings} aria-label="Settings" title="Settings">
                <Settings />
              </button>
            )}
            <button className="outline dark sidebar-collapse-btn" onClick={onToggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
          </div>
          <div className="sidebar-exit">
            {backLink && (
              <button className="outline dark" onClick={backLink.onClick} title={backLink.label} aria-label={backLink.label}>
                <ArrowLeft /> <span>Back</span>
              </button>
            )}
            <button className="sidebar-endsession" data-tour="end" onClick={onEndSession} title={endLabel} aria-label={endLabel}>
              <Flag /> <span>End</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
