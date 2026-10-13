import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import PageTitle from "../components/PageTitle";
import { useDocs } from "../hooks/useLiveDocs";
import { queueOrder } from "../utils/queueStatus";
import { upNextByCourt } from "../utils/rotationModes";
import { normalizeMode } from "../data/constants";

// The read-only queue of a live game, for the club's members: who is waiting, in order, and who is on each
// court. The line is the queue app's order and "Next" is the queue app's own pick for each court (same as the
// host's Up Next), though a host who edits Up Next or picks by hand can still change it.
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
  const mode = normalizeMode(state.event.mode) || "Balanced";
  const picks = upNextByCourt({ pool: queue, courts, mode, need: state.event.format === "Singles" ? 2 : 4, now: Date.now() });
  const nextCourt = Object.fromEntries(courts.flatMap((c) => (picks[c.id] || []).map((p) => [p.id, c.courtNumber])));
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
                {nextCourt[p.id] && <span className="queue-next">Next · Court {nextCourt[p.id]}</span>}
                <span className="queue-games">{p.games || 0} {p.games === 1 ? "game" : "games"}</span>
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
                {on.length > 0 && picks[c.id]?.length > 0 && <p className="queue-court-next">Next: {picks[c.id].map((p) => p.name).join(", ")}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
