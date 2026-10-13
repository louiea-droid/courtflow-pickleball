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
        <div className="panel notice">
          <p>{text}</p>
          <a className="outline back-link" href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>
            <ArrowLeft size={14} /> {label}
          </a>
        </div>
      </main>
    </div>
  );
}

// /clubs/:id/event/:eventId/game: the queue app on one event. The event doc is the session; the club's
// settings (rules, cost defaults, display) are merged over it by buildGameSession.
export default function Game({ clubId, club, event, ready, base, navigate, endGame, onSetAttendeePaid, memberChoices }) {
  if (!event) {
    return ready ? (
      <Message text="This open play doesn't exist or was deleted." to={`${base}/host`} label="Back to open play" navigate={navigate} />
    ) : <div className="loading"><span className="spinner" />Loading…</div>;
  }
  const eventPage = `${base}/event/${event.id}`;
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
      base={eventBase(clubId, event.id)}
      deriveSession={(raw) => buildGameSession(club, raw)}
      eyebrow={`${event.title} · ${formatDay(event.date)}`}
      backLabel="Back to event"
      onBack={() => navigate(eventPage)}
      onEndSession={() => endGame(event.id)}
      onSetAttendeePaid={(attendeeId, paid) => onSetAttendeePaid(event.id, attendeeId, paid)}
      memberChoices={memberChoices}
      clubName={club?.name}
    />
  );
}
