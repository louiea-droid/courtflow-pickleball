import { useEffect } from "react";
import { firebaseConfigured } from "./firebase";
import { useSessionData } from "./hooks/useSessionData";
import PhClock from "./components/PhClock";
import StarDisplay from "./components/StarDisplay";
import ElapsedTimer from "./components/ElapsedTimer";
import { initials, waitMinutes } from "./utils/format";

function LiveTeam({ label, color, ids, players }) {
  return (
    <div className="team">
      <div className={color}>{label}</div>
      {ids.map((id) => {
        const p = players.find((x) => x.id === id);
        if (!p) return null;
        return (
          <div className="chip" key={id}>
            <div><b>{p.name}</b><small><StarDisplay value={p.skill} /></small></div>
          </div>
        );
      })}
    </div>
  );
}

function LiveCourt({ c, players }) {
  const isEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
  return (
    <div className="court">
      <div className="court-top">
        <b>{c.name || `Court ${c.courtNumber}`}</b>
        {c.level && c.level !== "Any Level" && <span className="badge-level-quiet">{c.level}</span>}
        {isEmpty ? <span className="badge-open">OPEN</span> : <span>● LIVE</span>}
        {!isEmpty && <ElapsedTimer start={c.start} />}
      </div>
      {isEmpty ? (
        <div className="court-empty"><p>Court is open.</p></div>
      ) : (
        <div className="teams">
          <LiveTeam label="Team 1" color="blue" ids={c.teamA || []} players={players} />
          <LiveTeam label="Team 2" color="orange" ids={c.teamB || []} players={players} />
        </div>
      )}
    </div>
  );
}

export default function LiveBoard() {
  const { session, players, courts, busy } = useSessionData();

  useEffect(() => {
    document.title = session.location ? `${session.location} — Live Board` : "CourtFlow — Live Board";
  }, [session.location]);

  if (!firebaseConfigured) {
    return <div className="loading">Live board unavailable — Firebase isn't configured.</div>;
  }
  if (busy) {
    return (
      <div className="loading">
        <span className="spinner" />
        Loading live board…
      </div>
    );
  }

  const playing = new Set(courts.flatMap((c) => [...(c.teamA || []), ...(c.teamB || [])]));
  const queue = players.filter((p) => p.checked && !playing.has(p.id))
    .sort((a, b) => a.games - b.games || a.checkedAt - b.checkedAt);

  return (
    <div className="liveboard">
      <header className="liveboard-header">
        <div className="liveboard-brand">
          <img className="liveboard-logo" src="/images/courtflow logo.png" alt="CourtFlow" />
          <div>
            <div className="eyebrow">LIVE BOARD</div>
            <h1>{session.location}</h1>
            <p>{courts.length} {courts.length === 1 ? "court" : "courts"} · {session.format}</p>
          </div>
        </div>
        <PhClock />
      </header>

      <div className="heading">
        <div><h2>Live Courts</h2><p>Updates automatically.</p></div>
      </div>
      <div className="courts">
        {courts.map((c) => <LiveCourt key={c.id} c={c} players={players} />)}
        {!courts.length && <div className="empty">No courts yet.</div>}
      </div>

      <div className="heading liveboard-queue-heading">
        <div><h2>Waiting Queue</h2><p>{queue.length} player{queue.length === 1 ? "" : "s"} waiting.</p></div>
      </div>
      <div className="panel table">
        <div className="row header">
          <span>#</span><span>Player</span><span>Skill</span><span>Games</span><span>W/L</span><span>Wait</span><span />
        </div>
        {queue.map((p, i) => (
          <div className="row" key={p.id}>
            <span>{i + 1}</span>
            <span className="person"><i>{initials(p.name)}</i><b>{p.name}</b></span>
            <span><StarDisplay value={p.skill} /></span>
            <span>{p.games}</span>
            <span>{p.wins}/{p.losses}</span>
            <span>{waitMinutes(p)} min</span>
            <span />
          </div>
        ))}
        {!queue.length && <div className="empty">Queue is empty.</div>}
      </div>
    </div>
  );
}
