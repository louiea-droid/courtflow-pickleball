import { ArrowLeft } from "lucide-react";
import QueueApp from "./QueueApp";
import { eventBase } from "./utils/paths";
import { buildGameSession } from "./utils/gameSession";
import { formatDay } from "./utils/format";

// A message with a way back, for a game link that can't open a game right now.
function Message({ text, to, label, navigate }) {
  return (
    <div className="acct-shell">
      <main className="acct-main">
        <div className="panel">
          <div className="empty">{text}</div>
          <a className="outline back-link" href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>
            <ArrowLeft size={14} /> {label}
          </a>
        </div>
      </main>
    </div>
  );
}

// /event/:id/game: the queue app on one event. The event doc is the session; the account's
// settings (rules, cost defaults, display) are merged over it by buildGameSession.
export default function Game({ uid, account, event, ready, navigate, endGame, onSetAttendeePaid }) {
  if (!event) {
    return ready ? (
      <Message text="This open play doesn't exist or was deleted." to="/host" label="Back to open play" navigate={navigate} />
    ) : <div className="loading"><span className="spinner" />Loading…</div>;
  }
  const eventPage = `/event/${event.id}`;
  if (event.status === "ended") {
    return <Message text="This game has ended. Reopen it from the event page to keep playing." to={eventPage} label="Back to event" navigate={navigate} />;
  }
  if (event.status !== "live") {
    return <Message text="This game hasn't started. Start it from the event page." to={eventPage} label="Back to event" navigate={navigate} />;
  }
  return (
    <QueueApp
      key={event.id}
      kind="event"
      base={eventBase(uid, event.id)}
      deriveSession={(raw) => buildGameSession(account, raw)}
      eyebrow={`${event.title} · ${formatDay(event.date)}`}
      backLabel="Back to event"
      onBack={() => navigate(eventPage)}
      onEndSession={() => endGame(event.id)}
      onSetAttendeePaid={(attendeeId, paid) => onSetAttendeePaid(event.id, attendeeId, paid)}
    />
  );
}
