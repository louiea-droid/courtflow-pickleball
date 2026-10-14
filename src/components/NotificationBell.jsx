import { useEffect, useRef, useState } from "react";
import { Bell, MessageSquare, Play, UserPlus, Users } from "lucide-react";
import { useEscape } from "../hooks/useEscape";
import { capItems, markSeen, unseenCount } from "../utils/notifications";

const SEEN_KEY = "courtflow.notifSeen";
const ICONS = { turn: Play, friend: UserPlus, join: Users, chat: MessageSquare };

// "Seen" lives on this device. Blocked or full storage just means everything counts as new.
const readSeen = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY));
    return Array.isArray(v) ? v.filter((k) => typeof k === "string") : [];
  } catch { return []; }
};
const writeSeen = (seen) => {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* not remembered */ }
};

function Panel({ shown, more, top, navigate, close, onEscape }) {
  useEscape(onEscape);
  const go = (to) => (e) => { e.preventDefault(); close(); navigate(to); };
  return (
    <div className="acct-bell-panel" role="region" aria-label="Notifications" style={{ "--bell-top": `${top}px` }}>
      {shown.length ? (
        <ul>
          {shown.map((n) => {
            const Icon = ICONS[n.kind];
            return (
              <li key={n.key}>
                <a className="acct-bell-row" href={n.to} onClick={go(n.to)}>
                  <span className={`acct-bell-icon ${n.kind}`}><Icon size={16} aria-hidden="true" /></span>
                  <span className="acct-bell-text"><b>{n.title}</b>{n.sub && <small>{n.sub}</small>}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="acct-bell-empty">You're all caught up.</p>
      )}
      {more > 0 && <a className="acct-bell-more" href="/inbox" onClick={go("/inbox")}>and {more} more</a>}
    </div>
  );
}

export default function NotificationBell({ items, navigate }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(60);
  const [seen, setSeen] = useState(readSeen);
  const root = useRef(null);
  const button = useRef(null);
  const unseen = open ? 0 : unseenCount(items, seen); // while the panel is open everything on it counts as seen
  const { shown, more } = capItems(items);

  // Opening marks everything seen; new items that arrive while it is open are marked too.
  useEffect(() => {
    if (!open) return;
    setSeen((cur) => {
      const next = markSeen(cur, items);
      if (next !== cur) writeSeen(next);
      return next;
    });
  }, [open, items]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const toggle = () => {
    if (!open && button.current) setTop(Math.round(button.current.getBoundingClientRect().bottom) + 8); // the phone sheet hangs from here
    setOpen((o) => !o);
  };

  return (
    <div className="acct-bell" ref={root}>
      <button
        type="button" ref={button} className="acct-bell-btn" aria-haspopup="true" aria-expanded={open}
        aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"} onClick={toggle}
      >
        <Bell size={19} aria-hidden="true" />
        {unseen > 0 && <span className="acct-bell-badge" aria-hidden="true">{unseen > 9 ? "9+" : unseen}</span>}
      </button>
      <span className="acct-bell-live" aria-live="polite">{unseen ? `${unseen} new notifications` : ""}</span>
      {open && (
        <Panel
          shown={shown} more={more} top={top} navigate={navigate} close={() => setOpen(false)}
          onEscape={() => { setOpen(false); button.current?.focus(); }}
        />
      )}
    </div>
  );
}
