import { CalendarDays, ListOrdered, Settings, Users } from "lucide-react";

// `soon` cards are the next build steps. The quick session at /club needs no login.
const CARDS = [
  { key: "host", icon: CalendarDays, title: "Host open play", body: "Schedule open play, take bookings and payments, then run the game.", soon: true },
  { key: "players", icon: Users, title: "Players", body: "Your roster, remembered across every open play.", soon: true },
  { key: "settings", icon: Settings, title: "Settings", body: "Club name, theme, queue rules and cost defaults.", to: "/settings" },
  { key: "club", icon: ListOrdered, title: "Quick session", body: "Run the queue right now, no booking needed. Saved on this device.", href: "/club" },
];

export default function Hub({ clubName, navigate }) {
  return (
    <>
      <h1>{clubName}</h1>
      <p>What would you like to do?</p>
      <div className="hub-grid">
        {CARDS.map(({ key, icon: Icon, title, body, soon, to, href }) => {
          const inner = (
            <>
              <Icon size={22} />
              <b>{title}</b>
              <span>{body}</span>
              {soon && <em className="pill off">Coming soon</em>}
            </>
          );
          if (soon) return <button key={key} className="hub-card" disabled>{inner}</button>;
          if (href) return <a key={key} className="hub-card" href={href}>{inner}</a>;
          return (
            <a key={key} className="hub-card" href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>{inner}</a>
          );
        })}
      </div>
    </>
  );
}
