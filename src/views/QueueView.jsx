import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import PageTitle from "../components/PageTitle";
import { useDocs } from "../hooks/useLiveDocs";
import { queueOrder } from "../utils/queueStatus";

// The read-only queue of a live game, for the club's members: who is waiting, in order, and who is on each
// court. The order is the queue app's default; a host who picks by hand can change who goes next.
export default function QueueView({ clubId, base, eventId, uid, navigate }) {
  const [state, setState] = useState({ event: null, ready: false });
  useEffect(() => {
    setState({ event: null, ready: false });
    if (!firebaseConfigured) return undefined;
    return onSnapshot(
      doc(db, "clubs", clubId, "events", eventId),
      (s) => setState({ event: s.exists() ? { id: s.id, ...s.data() } : null, ready: true }),
      () => setState({ event: null, ready: true }),
    );
  }, [clubId, eventId]);
  const live = state.event?.status === "live";
  const path = live ? ["clubs", clubId, "events", eventId] : null;
  const players = useDocs(path && [...path, "players"]);
  const courts = [...useDocs(path && [...path, "courts"])].sort((a, b) => a.courtNumber - b.courtNumber);
  const back = (
    <a className="back-link" href={base} onClick={(e) => { e.preventDefault(); navigate(base); }}><ArrowLeft size={14} /> Back to the club</a>
  );

  if (!state.ready) return <p className="hub-empty">Loading…</p>;
  if (!state.event || !live) {
    return (
      <div className="panel notice">
        <p>{state.event ? "This game isn't running right now. The queue shows while a game is live." : "This game doesn't exist or was deleted."}</p>
        <a className="outline back-link" href={base} onClick={(e) => { e.preventDefault(); navigate(base); }}><ArrowLeft size={14} /> Back to the club</a>
      </div>
    );
  }

  const queue = queueOrder(players, courts);
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  return (
    <>
      {back}
      <PageTitle title={state.event.title} sub="Live queue" />
      <div className="panel members-block">
        <h2 className="club-section">Waiting</h2>
        {queue.length === 0 ? (
          <p className="hub-empty">Nobody is waiting right now.</p>
        ) : (
          <ol className="queue-list">
            {queue.map((p, i) => (
              <li key={p.id} className={`queue-row${p.uid === uid ? " me" : ""}`}>
                <span className="queue-pos">{i + 1}</span>
                <span className="queue-name">{p.name}{p.uid === uid ? " (you)" : ""}</span>
                <span className="queue-games">{p.games} {p.games === 1 ? "game" : "games"}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="panel members-block">
        <h2 className="club-section">On court</h2>
        <div className="queue-courts">
          {courts.map((c) => {
            const on = [...(c.teamA || []), ...(c.teamB || [])].map((id) => names[id]).filter(Boolean);
            return (
              <div className="queue-court" key={c.id}>
                <b>Court {c.courtNumber}</b>
                <p>{on.length ? on.join(", ") : "Free"}</p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
