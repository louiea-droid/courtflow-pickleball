import { useState } from "react";
import { X, ArrowLeftRight, Zap, Play } from "lucide-react";
import PanelHead from "../components/PanelHead";
import StarDisplay from "../components/StarDisplay";
import { waitMinutes, elapsed } from "../utils/format";

function Stat({ n, l, s }) {
  return (
    <div className="stat">
      <span>{l}</span>
      <b>{n}</b>
      <small>{s}</small>
    </div>
  );
}

function Team({ label, color, ids, players, queue, swapOpenId, onSwapClick, onSwap, remove }) {
  return (
    <div className="team">
      <div className={color}>{label}</div>
      {ids.map((id) => {
        const p = players.find((x) => x.id === id);
        if (!p) return null;
        return (
          <div className="chip-wrap" key={id}>
            <div className="chip">
              <div><b>{p.name}</b><small><StarDisplay value={p.skill} /></small></div>
              <div className="chip-actions">
                <button className="chip-btn swap" title="Swap player" onClick={() => onSwapClick(id)}>
                  <ArrowLeftRight size={13} />
                </button>
                <button className="chip-btn remove" title="Remove" onClick={() => remove(id)}>
                  <X size={13} />
                </button>
              </div>
            </div>
            {swapOpenId === id && (
              <div className="swap-menu">
                {queue.length ? queue.map((q) => (
                  <button key={q.id} className="swap-item" onClick={() => onSwap(id, q.id)}>{q.name}</button>
                )) : <div className="swap-empty">Queue is empty.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CourtEmpty({ need, upNext, onStartNext }) {
  const ready = upNext.length >= need;
  return (
    <div className="court-empty">
      <div className="court-empty-icon"><Play size={16} /></div>
      <p>{ready ? "Court is open. Ready to start the next match." : `Waiting on ${need - upNext.length} more player(s) to check in.`}</p>
      {upNext.length > 0 && (
        <div className="court-empty-names">{upNext.map((p) => p.name).join(" · ")}</div>
      )}
      <button className="primary" disabled={!ready} onClick={onStartNext}>
        <Play size={14} /> Start Next Match
      </button>
    </div>
  );
}

function Court({ c, players, queue, need, win, remove, swap, onStartNext }) {
  const [swapOpen, setSwapOpen] = useState(null);
  const toggleSwap = (id) => setSwapOpen((cur) => (cur === id ? null : id));
  const handleSwap = (oldId, newId) => { swap(c.id, oldId, newId); setSwapOpen(null); };
  const isEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;

  return (
    <div className="court">
      <div className="court-top">
        <b>Court {c.courtNumber}</b>
        {isEmpty ? <span className="badge-open">OPEN</span> : <span>● LIVE</span>}
        {!isEmpty && <small>{elapsed(c.start)}</small>}
      </div>
      {isEmpty ? (
        <CourtEmpty need={need} upNext={queue.slice(0, need)} onStartNext={() => onStartNext(c.id)} />
      ) : (
        <>
          <div className="teams">
            <Team label="Team 1" color="blue" ids={c.teamA || []} players={players} queue={queue}
              swapOpenId={swapOpen} onSwapClick={toggleSwap} onSwap={handleSwap} remove={(id) => remove(c.id, id)} />
            <Team label="Team 2" color="orange" ids={c.teamB || []} players={players} queue={queue}
              swapOpenId={swapOpen} onSwapClick={toggleSwap} onSwap={handleSwap} remove={(id) => remove(c.id, id)} />
          </div>
          <div className="winrow">
            <button onClick={() => win(c.id, "A")}>Team 1 Wins</button>
            <button onClick={() => win(c.id, "B")}>Team 2 Wins</button>
          </div>
        </>
      )}
    </div>
  );
}

function PreviewTeam({ label, color, list, queue, swapOpenId, onSwapClick, onSwap, onSkip }) {
  return (
    <div className="team">
      <div className={color}>{label}</div>
      {list.length ? list.map((p) => (
        <div className="chip-wrap" key={p.id}>
          <div className="chip">
            <div><b>{p.name}</b><small><StarDisplay value={p.skill} /></small></div>
            <div className="chip-actions">
              <button className="chip-btn swap" title="Change player" onClick={() => onSwapClick(p.id)}>
                <ArrowLeftRight size={13} />
              </button>
              <button className="chip-btn remove" title="Send to back of queue" onClick={() => onSkip(p.id)}>
                <X size={13} />
              </button>
            </div>
          </div>
          {swapOpenId === p.id && (
            <div className="swap-menu">
              {queue.filter((q) => q.id !== p.id).length ? queue.filter((q) => q.id !== p.id).map((q) => (
                <button key={q.id} className="swap-item" onClick={() => onSwap(p.id, q.id)}>{q.name}</button>
              )) : <div className="swap-empty">No other players waiting.</div>}
            </div>
          )}
        </div>
      )) : <div className="chip placeholder"><small>Waiting for players…</small></div>}
    </div>
  );
}

function CourtPreview({ label, group, need, queue, onSwapOrder, onSkip }) {
  const [swapOpen, setSwapOpen] = useState(null);
  const toggleSwap = (id) => setSwapOpen((cur) => (cur === id ? null : id));
  const handleSwap = (aId, bId) => { onSwapOrder(aId, bId); setSwapOpen(null); };
  const teamA = group.slice(0, Math.ceil(need / 2));
  const teamB = group.slice(Math.ceil(need / 2), need);
  return (
    <div className="court preview">
      <div className="court-top">
        <b>{label}</b>
        <span className="badge-next">NEXT</span>
      </div>
      <div className="teams">
        <PreviewTeam label="Team 1" color="blue" list={teamA} queue={queue}
          swapOpenId={swapOpen} onSwapClick={toggleSwap} onSwap={handleSwap} onSkip={onSkip} />
        <PreviewTeam label="Team 2" color="orange" list={teamB} queue={queue}
          swapOpenId={swapOpen} onSwapClick={toggleSwap} onSwap={handleSwap} onSkip={onSkip} />
      </div>
    </div>
  );
}

export default function Dashboard({
  session, players, courts, queue, recordWin, removePlayer, swapPlayer,
  autoRotateOn, onToggleAutoRotate, onAutoFill, onStartNext, onSwapQueueOrder, onSkipQueued, goQueue,
}) {
  const need = session.format === "Singles" ? 2 : 4;
  const upNext = [queue.slice(0, need), queue.slice(need, need * 2)];

  return (
    <>
      <div className="cards">
        <Stat n={players.filter((p) => p.checked).length} l="PLAYERS" s="checked in" />
        <Stat n={session.courts} l="COURTS" s="active courts" />
        <Stat n={queue.length} l="WAITING" s="in queue" />
        <Stat n={Math.min(queue.length, need)} l="NEXT UP" s="staged players" />
      </div>

      <div className="heading">
        <div><h2>Live Courts</h2><p>Record a winner to rotate the completed players.</p></div>
        <div className="heading-actions">
          <button className="outline" onClick={onAutoFill}><Zap size={14} /> Auto-fill</button>
          <button
            className={`pill toggle ${autoRotateOn ? "" : "off"}`}
            onClick={onToggleAutoRotate}
            title="Toggle automatic queue rotation on court wins"
          >
            {autoRotateOn ? "● Auto-rotation ON" : "○ Auto-rotation OFF"}
          </button>
        </div>
      </div>
      <div className="courts">
        {courts.map((c) => (
          <Court key={c.id} c={c} players={players} queue={queue} need={need}
            win={recordWin} remove={removePlayer} swap={swapPlayer} onStartNext={onStartNext} />
        ))}
      </div>

      <div className="heading">
        <div><h2>Up Next</h2><p>Preview of who rotates onto each court next.</p></div>
      </div>
      <div className="courts">
        <CourtPreview label="Court 1" group={upNext[0]} need={need} queue={queue} onSwapOrder={onSwapQueueOrder} onSkip={onSkipQueued} />
        <CourtPreview label="Court 2" group={upNext[1]} need={need} queue={queue} onSwapOrder={onSwapQueueOrder} onSkip={onSkipQueued} />
      </div>

      <div className="lower">
        <div className="panel">
          <PanelHead title="Next Up" sub="Priority follows fewer games + wait time." button="View queue →" action={goQueue} />
          {queue.slice(0, 4).map((p, i) => (
            <div className="next" key={p.id}>
              <strong>{i + 1}</strong>
              <div><b>{p.name}</b><small><StarDisplay value={p.skill} /> · {p.games} games</small></div>
              <em>{waitMinutes(p)}m</em>
            </div>
          ))}
        </div>
        <div className="panel">
          <PanelHead title="Session Rules" sub="Balanced rotation" />
          <div className="rules">
            <div><b>1</b>Completed players return to the back of the line.</div>
            <div><b>2</b>Players with fewer games get priority.</div>
            <div><b>3</b>Avoid repeat partners when possible.</div>
          </div>
        </div>
      </div>
    </>
  );
}
