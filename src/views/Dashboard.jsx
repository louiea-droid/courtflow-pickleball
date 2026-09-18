import { useEffect, useRef, useState } from "react";
import { X, ArrowLeftRight, Zap, Play, Plus, Pencil } from "lucide-react";
import PanelHead from "../components/PanelHead";
import PersonBadge from "../components/PersonBadge";
import MatchLogRow from "../components/MatchLogRow";
import StarDisplay from "../components/StarDisplay";
import CourtLevelSelect from "../components/CourtLevelSelect";
import ConfirmDialog from "../components/ConfirmDialog";
import ElapsedTimer from "../components/ElapsedTimer";
import { waitMinutes } from "../utils/format";
import { matchesCourtLevel } from "../utils/courtLevels";
import { selectForCourt } from "../utils/rotationModes";

// Closes an open swap menu when clicking/tapping outside the given
// container, or pressing Escape — mirrors the same pattern used by the
// other dropdowns in the app (CourtLevelSelect, ModeSelect, Select).
function useCloseSwapOnOutside(containerRef, active, close) {
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) close();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, containerRef, close]);
}

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
                )) : <div className="swap-empty">No eligible players waiting.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CourtEmpty({ need, upNext, queueLength, onStartNext }) {
  const ready = upNext.length >= need;
  let message = "Court is open. Ready to start the next match.";
  if (!ready) {
    message = upNext.length === 0 && queueLength > 0
      ? "Waiting for enough matching players to check in."
      : `Waiting on ${need - upNext.length} more player(s) to check in.`;
  }
  return (
    <div className="court-empty">
      <div className="court-empty-icon"><Play size={16} /></div>
      <p>{message}</p>
      {upNext.length > 0 && (
        <div className="court-empty-names">{upNext.map((p) => p.name).join(" · ")}</div>
      )}
      <button className="primary" disabled={!ready} onClick={onStartNext}>
        <Play size={14} /> Start Next Match
      </button>
    </div>
  );
}

function CourtTitle({ court, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const displayName = court.name || `Court ${court.courtNumber}`;

  const startEdit = () => { setValue(court.name || ""); setEditing(true); };
  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (trimmed !== (court.name || "")) onRename(court.id, trimmed || null);
  };

  if (editing) {
    return (
      <input
        className="court-name-input"
        autoFocus
        value={value}
        placeholder={`Court ${court.courtNumber}`}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setValue(court.name || ""); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  return <b className="court-name" title="Click to rename" onClick={startEdit}>{displayName}</b>;
}

function Court({ c, players, queue, need, upNext, win, remove, swap, onStartNext, onSetLevel, onRemoveCourt, canRemove, onRenameCourt }) {
  const [swapOpen, setSwapOpen] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const teamsRef = useRef(null);
  const toggleSwap = (id) => setSwapOpen((cur) => (cur === id ? null : id));
  const handleSwap = (oldId, newId) => { swap(c.id, oldId, newId); setSwapOpen(null); };
  const isEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
  const eligibleQueue = queue.filter((p) => matchesCourtLevel(p.skill, c.level));
  useCloseSwapOnOutside(teamsRef, swapOpen !== null, () => setSwapOpen(null));

  return (
    <div className="court">
      {canRemove && (
        <button className="court-remove" title="Remove court" onClick={() => setConfirmRemove(true)}><X size={14} /></button>
      )}
      <div className="court-top">
        <CourtTitle court={c} onRename={onRenameCourt} />
        <CourtLevelSelect level={c.level} onChange={(level) => onSetLevel(c.id, level)} />
        {isEmpty ? <span className="badge-open">OPEN</span> : <span>● LIVE</span>}
        {!isEmpty && <ElapsedTimer start={c.start} />}
      </div>
      {confirmRemove && (
        <ConfirmDialog
          title={`Remove ${c.name || `Court ${c.courtNumber}`}?`}
          message={isEmpty ? "This court will be removed from the session." : "Players on this court will return to the queue."}
          onCancel={() => setConfirmRemove(false)}
          onConfirm={() => { setConfirmRemove(false); onRemoveCourt(c.id); }}
        />
      )}
      {isEmpty ? (
        <CourtEmpty need={need} upNext={upNext} queueLength={queue.length} onStartNext={() => onStartNext(c.id)} />
      ) : (
        <>
          <div className="teams" ref={teamsRef}>
            <Team label="Team 1" color="team1" ids={c.teamA || []} players={players} queue={eligibleQueue}
              swapOpenId={swapOpen} onSwapClick={toggleSwap} onSwap={handleSwap} remove={(id) => remove(c.id, id)} />
            <Team label="Team 2" color="team2" ids={c.teamB || []} players={players} queue={eligibleQueue}
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
              )) : <div className="swap-empty">No other eligible players waiting.</div>}
            </div>
          )}
        </div>
      )) : <div className="chip placeholder"><small>Waiting for players…</small></div>}
    </div>
  );
}

function CourtPreview({ label, level, group, need, queue, onSwapOrder, onSkip, onSendToCourt, canSend }) {
  const [swapOpen, setSwapOpen] = useState(null);
  const teamsRef = useRef(null);
  const toggleSwap = (id) => setSwapOpen((cur) => (cur === id ? null : id));
  const handleSwap = (aId, bId) => { onSwapOrder(aId, bId); setSwapOpen(null); };
  const teamA = group.slice(0, Math.ceil(need / 2));
  const teamB = group.slice(Math.ceil(need / 2), need);
  const eligibleQueue = queue.filter((p) => matchesCourtLevel(p.skill, level));
  const ready = group.length >= need;
  useCloseSwapOnOutside(teamsRef, swapOpen !== null, () => setSwapOpen(null));
  return (
    <div className="court preview">
      <div className="court-top">
        <b>{label}</b>
        {level && level !== "Any Level" && <span className="badge-level-quiet">{level}</span>}
        <span className="badge-next">NEXT</span>
      </div>
      <div className="teams" ref={teamsRef}>
        <PreviewTeam label="Team 1" color="team1" list={teamA} queue={eligibleQueue}
          swapOpenId={swapOpen} onSwapClick={toggleSwap} onSwap={handleSwap} onSkip={onSkip} />
        <PreviewTeam label="Team 2" color="team2" list={teamB} queue={eligibleQueue}
          swapOpenId={swapOpen} onSwapClick={toggleSwap} onSwap={handleSwap} onSkip={onSkip} />
      </div>
      {ready ? (
        <button
          className="primary preview-send"
          disabled={!canSend}
          onClick={() => onSendToCourt(teamA.map((p) => p.id), teamB.map((p) => p.id))}
        >
          <Play size={14} /> Send to Court
        </button>
      ) : (
        <div className="preview-empty-note">Not enough players yet.</div>
      )}
    </div>
  );
}

export default function Dashboard({
  session, players, courts, queue, matchLog, recordWin, removePlayer, swapPlayer,
  autoRotateOn, onToggleAutoRotate, onAutoFill, onAddCourt, onRemoveCourt, onSetCourtLevel, onRenameCourt,
  onStartNext, onSwapQueueOrder, onSkipQueued, onEditPlayer, onSendToCourt, goQueue,
}) {
  const need = session.format === "Singles" ? 2 : 4;
  const mode = session.mode || session.rotation || "Balanced";
  const hasOpenCourt = courts.some((c) => (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0);

  // Reserve consecutive, non-overlapping, level-matched slices of the queue:
  // first for any open courts (shown inline via "Start Next Match"), then one
  // per live court for the "Up Next" preview below — so no player, and no
  // level-restricted seat, is double-counted across courts.
  let pool = queue;
  const courtViews = courts.map((c) => {
    const isEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
    if (!isEmpty) return { court: c, upNext: [] };
    const { taken, remaining } = selectForCourt({ pool, court: c, mode, need });
    pool = remaining;
    return { court: c, upNext: taken };
  });
  // One "Up Next" preview per court, always — so adding/removing a court
  // immediately adds/removes its preview box too. An open court just mirrors
  // the same "ready now" group already shown inline on its own card; a live
  // court previews who rotates in once its current match ends.
  const upcomingPreviews = courtViews.map(({ court: c, upNext: emptyUpNext }) => {
    const isEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
    const label = c.name || `Court ${c.courtNumber}`;
    if (isEmpty) return { key: c.id, label, level: c.level, group: emptyUpNext };
    const { taken, remaining } = selectForCourt({ pool, court: c, mode, need });
    pool = remaining;
    return { key: c.id, label, level: c.level, group: taken };
  });

  return (
    <>
      <div className="cards">
        <Stat n={players.length} l="PLAYERS" s="total players" />
        <Stat n={players.filter((p) => p.checked).length} l="CHECKED IN" s="checked in" />
        <Stat n={queue.length} l="WAITING" s="in queue" />
        <Stat n={courts.length} l="COURTS" s="active courts" />
      </div>

      <div className="heading">
        <div><h2>Live Courts</h2><p>Record a winner to rotate the completed players.</p></div>
        <div className="heading-actions">
          <button className="outline" onClick={onAddCourt} disabled={courts.length >= 8}>
            <Plus size={14} /> Add Court
          </button>
          <button className="outline" onClick={onAutoFill}><Zap size={14} /> Auto-fill</button>
          <button
            className={`pill toggle ${autoRotateOn ? "" : "off"}`}
            onClick={onToggleAutoRotate}
            title="Toggle automatic queue rotation on court wins"
          >
            {autoRotateOn ? "●" : "○"} Auto<span className="label-full">-rotation</span> {autoRotateOn ? "ON" : "OFF"}
          </button>
        </div>
      </div>
      <div className="courts">
        {courtViews.map(({ court: c, upNext }) => (
          <Court key={c.id} c={c} players={players} queue={queue} need={need} upNext={upNext}
            win={recordWin} remove={removePlayer} swap={swapPlayer} onStartNext={onStartNext} onSetLevel={onSetCourtLevel}
            onRemoveCourt={onRemoveCourt} canRemove={courts.length > 1} onRenameCourt={onRenameCourt} />
        ))}
      </div>

      {upcomingPreviews.length > 0 && (
        <>
          <div className="heading">
            <div><h2>Up Next</h2><p>Preview of who rotates onto each court next.</p></div>
          </div>
          <div className="courts">
            {upcomingPreviews.map((pv) => (
              <CourtPreview key={pv.key} label={pv.label} level={pv.level} group={pv.group} need={need} queue={queue}
                onSwapOrder={onSwapQueueOrder} onSkip={onSkipQueued} onSendToCourt={onSendToCourt} canSend={hasOpenCourt} />
            ))}
          </div>
        </>
      )}

      <div className="lower">
        <div className="panel">
          <PanelHead title="Next Up" sub="Priority follows fewer games + wait time." button="View queue →" action={goQueue} />
          {queue.slice(0, 4).map((p, i) => (
            <div className="next" key={p.id}>
              <strong>{i + 1}</strong>
              <PersonBadge name={p.name}>
                <div className="next-meta">
                  <StarDisplay value={p.skill} />
                  <span className="queue-stat games">{p.games} <small>games</small></span>
                  <span className="queue-stat wins">{p.wins} <small>wins</small></span>
                </div>
              </PersonBadge>
              <div className="next-actions">
                <em>{waitMinutes(p)}m</em>
                <button className="icon" title="Edit player" onClick={() => onEditPlayer(p)}><Pencil size={13} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="panel">
          <PanelHead title="Match Log" sub="Recent results this session." />
          {matchLog.length
            ? matchLog.slice(0, 6).map((m) => <MatchLogRow match={m} key={m.id} />)
            : <div className="empty">No matches recorded yet.</div>}
        </div>
      </div>
    </>
  );
}
