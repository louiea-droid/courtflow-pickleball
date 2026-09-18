import { useEffect, useRef, useState } from "react";
import { firebaseConfigured } from "./firebase";
import { useSessionData } from "./hooks/useSessionData";
import { useCosts } from "./hooks/useCosts";
import { useMatchLog } from "./hooks/useMatchLog";
import MatchLogRow from "./components/MatchLogRow";
import PhClock from "./components/PhClock";
import StarDisplay from "./components/StarDisplay";
import ElapsedTimer from "./components/ElapsedTimer";
import { money } from "./utils/format";

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
          <LiveTeam label="Team 1" color="team1" ids={c.teamA || []} players={players} />
          <LiveTeam label="Team 2" color="team2" ids={c.teamB || []} players={players} />
        </div>
      )}
    </div>
  );
}

// A fixed-height list with no scrollbar: if every row fits, it just sits
// still. If it overflows, the list is duplicated back-to-back and animated in
// a continuous, seamless vertical scroll — smooth motion, not a jump-cut —
// sized so every waiting player keeps drifting into view on an unattended
// display (e.g. a TV), and paced by row count so it's never rushed.
function QueueTicker({ rows, rowCount }) {
  const wrapRef = useRef(null);
  const contentRef = useRef(null);
  const [scrolling, setScrolling] = useState(false);
  const [duration, setDuration] = useState(20);

  useEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;
    const measure = () => {
      const overflow = content.scrollHeight > wrap.clientHeight + 2;
      setScrolling(overflow);
      if (overflow) setDuration(Math.max(10, content.scrollHeight / 28));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(content);
    return () => ro.disconnect();
  }, [rowCount]);

  return (
    <div className="ticker" ref={wrapRef}>
      <div
        className={`ticker-track ${scrolling ? "scrolling" : ""}`}
        style={scrolling ? { animationDuration: `${duration}s` } : undefined}
      >
        <div className="ticker-content" ref={contentRef}>{rows}</div>
        {scrolling && <div className="ticker-content" aria-hidden="true">{rows}</div>}
      </div>
    </div>
  );
}

export default function LiveBoard() {
  const clubId = new URLSearchParams(window.location.search).get("club");
  const { session, players, courts, busy } = useSessionData(clubId);
  const costs = useCosts(clubId);
  const matchLog = useMatchLog(clubId);

  useEffect(() => {
    document.title = session.location ? `${session.location} — Live Board` : "CourtFlow — Live Board";
  }, [session.location]);

  if (!firebaseConfigured) {
    return <div className="loading">Live board unavailable — Firebase isn't configured.</div>;
  }
  if (!clubId) {
    return <div className="loading">No club specified. Ask for a fresh share link from the app.</div>;
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
  const visibleCosts = costs.filter((c) => c.visibleOnLive);

  const queueRows = queue.map((p, i) => (
    <div className="queue-row" key={p.id}>
      <span className="queue-rank">{i + 1}</span>
      <b>{p.name}</b>
      <StarDisplay value={p.skill} />
      <span className="queue-stats">
        <span className="queue-stat games">{p.games} <small>games</small></span>
        <span className="queue-stat wins">{p.wins} <small>wins</small></span>
      </span>
    </div>
  ));

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

      {visibleCosts.length > 0 && (
        <div className="liveboard-cost-strip">
          {visibleCosts.map((c) => (
            <div className="cost-chip" key={c.id}>
              <b>{c.label}</b>
              <span>{money(c.total)} total · {money(c.perPerson)} / player</span>
            </div>
          ))}
        </div>
      )}

      <div className="liveboard-body">
        <section className="liveboard-col liveboard-courts-col">
          <div className="liveboard-section-title"><h2>Live Courts</h2></div>
          <div className="liveboard-courts-grid">
            {courts.map((c) => <LiveCourt key={c.id} c={c} players={players} />)}
            {!courts.length && <div className="empty">No courts yet.</div>}
          </div>
        </section>

        <div className="liveboard-bottom-row">
          <section className="liveboard-col liveboard-queue-col">
            <div className="liveboard-section-title">
              <h2>Waiting Queue</h2>
              <span className="count-badge">{queue.length}</span>
            </div>
            <div className="panel liveboard-box">
              {queue.length ? (
                <QueueTicker rows={queueRows} rowCount={queue.length} />
              ) : (
                <div className="empty">Queue is empty.</div>
              )}
            </div>
          </section>

          <section className="liveboard-col liveboard-matchlog-col">
            <div className="liveboard-section-title"><h2>Match Log</h2></div>
            <div className="panel liveboard-box">
              {matchLog.length ? (
                <div className="matchlog-list">
                  {matchLog.map((m) => <MatchLogRow match={m} key={m.id} />)}
                </div>
              ) : (
                <div className="empty">No matches recorded yet.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
