import { useEffect, useRef, useState } from "react";
import { X, ArrowLeftRight, Zap, Play, Plus, Pencil, Hash, UserCheck } from "lucide-react";
import LockMark from "../components/LockMark";
import PanelHead from "../components/PanelHead";
import PersonBadge from "../components/PersonBadge";
import MatchLogRow from "../components/MatchLogRow";
import StarDisplay from "../components/StarDisplay";
import CourtLevelSelect from "../components/CourtLevelSelect";
import ConfirmDialog from "../components/ConfirmDialog";
import ElapsedTimer from "../components/ElapsedTimer";
import Modal from "../components/Modal";
import ScoreKeeper from "../components/ScoreKeeper";
import { call, finalText, liveScore, winner } from "../utils/scoring";
import { rankPlayers, waitMinutes, winPct } from "../utils/format";
import { matchesCourtLevel } from "../utils/courtLevels";
import { CircleAlert } from "lucide-react";
import { hasGender, ignoredLocks, splitTeams, upNextByCourt } from "../utils/rotationModes";
import { normalizeMode } from "../data/constants";

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

// The partner's name when this player is locked in with someone, else undefined.
const mateName = (p, players) => players.find((x) => x.id === p.lockedWithId)?.name;

// Waiting locked pairs as one menu entry each (the first of the pair stands for it), for swapping a locked pair.
function waitingPairs(queue) {
  const ids = new Set(queue.map((q) => q.id));
  const seen = new Set();
  return queue.filter((q) => {
    if (!q.lockedWithId || !ids.has(q.lockedWithId) || seen.has(q.id)) return false;
    seen.add(q.id); seen.add(q.lockedWithId); return true;
  }).map((q) => ({ q, mate: queue.find((x) => x.id === q.lockedWithId) }));
}

function Team({ label, color, ids, openSlots, players, queue, swapOpenId, onSwapClick, onSwap, remove, onAdd }) {
  return (
    <div className="team">
      <div className={color}>{label}</div>
      {ids.map((id) => {
        const p = players.find((x) => x.id === id);
        if (!p) return null;
        return (
          <div className="chip-wrap" key={id}>
            <div className="chip">
              <div><b>{p.name}{mateName(p, players) && <LockMark name={mateName(p, players)} />}</b><small><StarDisplay value={p.skill} /></small></div>
              <div className="chip-actions">
                <button className="chip-btn swap" title={p.lockedWithId && ids.includes(p.lockedWithId) ? "Swap this locked pair" : "Swap player"} onClick={() => onSwapClick(id)}>
                  <ArrowLeftRight size={13} />
                </button>
                <button className="chip-btn remove" title={p.lockedWithId && ids.includes(p.lockedWithId) ? "Remove this locked pair" : "Remove"} onClick={() => remove(id)}>
                  <X size={13} />
                </button>
              </div>
            </div>
            {swapOpenId === id && p.lockedWithId && ids.includes(p.lockedWithId) && (
              <div className="swap-menu">
                {waitingPairs(queue).length ? waitingPairs(queue).map(({ q, mate }) => (
                  <button key={q.id} className="swap-item" onClick={() => onSwap(id, q.id)}>
                    {q.name} + {mate.name}<small className="swap-item-lock">swaps the locked pair</small>
                  </button>
                )) : <div className="swap-empty">No other locked pair is waiting. Remove the pair to put others in.</div>}
              </div>
            )}
            {swapOpenId === id && !(p.lockedWithId && ids.includes(p.lockedWithId)) && (
              <div className="swap-menu">
                {queue.length ? queue.map((q) => (
                  <button key={q.id} className="swap-item" onClick={() => onSwap(id, q.id)}>
                    {q.name}
                    {q.lockedWithId && (
                      <small className="swap-item-lock">
                        locked w/ {players.find((x) => x.id === q.lockedWithId)?.name || "someone"}
                      </small>
                    )}
                  </button>
                )) : <div className="swap-empty">No eligible players waiting.</div>}
              </div>
            )}
          </div>
        );
      })}
      {Array.from({ length: openSlots }).map((_, i) => {
        const slotId = `add-${color}-${i}`;
        return (
          <div className="chip-wrap" key={slotId}>
            <button className="chip placeholder chip-add" onClick={() => onSwapClick(slotId)}>
              <Plus size={13} /><small>Add player</small>
            </button>
            {swapOpenId === slotId && (
              <div className="swap-menu">
                {queue.length ? queue.map((q) => (
                  <button key={q.id} className="swap-item" onClick={() => onAdd(q.id)}>
                    {q.name}
                    {q.lockedWithId && (
                      <small className="swap-item-lock">
                        locked w/ {players.find((x) => x.id === q.lockedWithId)?.name || "someone"}
                      </small>
                    )}
                  </button>
                )) : <div className="swap-empty">No eligible players waiting.</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CourtEmpty({ need, upNext, queueLength, onStartNext, manual }) {
  if (manual) {
    return (
      <div className="court-empty">
        <div className="court-empty-icon"><Play size={16} /></div>
        <p>Custom mode: build this match yourself. Use Call on the Queue tab to put players on this court.</p>
      </div>
    );
  }
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

function Court({ c, players, queue, need, upNext, win, remove, swap, addPlayer, onStartNext, onSetLevel, onRemoveCourt, canRemove, onRenameCourt, alertAfterMin, manual, claims, scoreSettings, onScore, onStopScore }) {
  const [swapOpen, setSwapOpen] = useState(null);
  const [scoring, setScoring] = useState(false);
  const claim = claims.find((x) => x.id === c.id);
  const sc = c.score && c.score.start === c.start ? c.score : null; // an old match's score never shows
  const done = sc ? winner(sc) : 0;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const teamsRef = useRef(null);
  const toggleSwap = (id) => setSwapOpen((cur) => (cur === id ? null : id));
  const handleSwap = (oldId, newId) => { swap(c.id, oldId, newId); setSwapOpen(null); };
  const handleAdd = (team, newId) => { addPlayer(c.id, team, newId); setSwapOpen(null); };
  const isEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
  const eligibleQueue = queue.filter((p) => matchesCourtLevel(p.skill, c.level));
  const perTeam = need / 2;
  const openSlotsA = isEmpty ? 0 : Math.max(0, perTeam - (c.teamA?.length || 0));
  const openSlotsB = isEmpty ? 0 : Math.max(0, perTeam - (c.teamB?.length || 0));
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
        {!isEmpty && (
          <button className="score-chip" onClick={() => setScoring(true)}
            title={sc ? `${call(sc)}${claim ? ` · Umpire: ${claim.name}` : ""}` : "Start score"}
            aria-label={sc ? `Score ${sc.t1} to ${sc.t2}, open the score screen` : "Start score"}>
            {sc ? <><b className="t1">{sc.t1}</b><i>-</i><b className="t2">{sc.t2}</b></> : <Hash size={13} />}
          </button>
        )}
        {!isEmpty && <ElapsedTimer start={c.start} alertAfterMin={alertAfterMin} />}
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
        <CourtEmpty need={need} upNext={upNext} queueLength={queue.length} manual={manual} onStartNext={() => onStartNext(c.id)} />
      ) : (
        <>
          <div className="teams" ref={teamsRef}>
            <Team label="Team 1" color="team1" ids={c.teamA || []} openSlots={openSlotsA} players={players} queue={eligibleQueue}
              swapOpenId={swapOpen} onSwapClick={toggleSwap} onSwap={handleSwap} remove={(id) => remove(c.id, id)}
              onAdd={(id) => handleAdd("A", id)} />
            <Team label="Team 2" color="team2" ids={c.teamB || []} openSlots={openSlotsB} players={players} queue={eligibleQueue}
              swapOpenId={swapOpen} onSwapClick={toggleSwap} onSwap={handleSwap} remove={(id) => remove(c.id, id)}
              onAdd={(id) => handleAdd("B", id)} />
          </div>
          {/* A kept score decides the result, so the plain win buttons only show for matches nobody is scoring. A game the
              umpire confirmed records by itself (see Dashboard); one that was never confirmed keeps a Record button. */}
          {done && sc.confirmed && c.recordedConfirm !== sc.confirmed ? (
            <p className="court-recording">Recording: Team {done} won {finalText(sc)}...</p>
          ) : done ? (
            <div className="court-score">
              <button className={`court-confirm team${done}`} onClick={() => win(c.id, done === 1 ? "A" : "B", finalText(sc))}>
                Confirm: Team {done} wins {finalText(sc)}
              </button>
            </div>
          ) : null}
          {!sc && (
            <div className="winrow">
              <button onClick={() => win(c.id, "A")}>Team 1 Wins</button>
              <button onClick={() => win(c.id, "B")}>Team 2 Wins</button>
            </div>
          )}
        </>
      )}
      {scoring && (
        <Modal title={c.name || `Court ${c.courtNumber}`} label={claim ? `SCORE · UMPIRE ${claim.name.toUpperCase()}` : "SCORE"} close={() => setScoring(false)}>
          <ScoreKeeper court={c} players={players} settings={scoreSettings}
            onScore={(next) => onScore(c.id, next)}
            onConfirm={(side) => { setScoring(false); win(c.id, side, finalText(liveScore(c, scoreSettings))); }}
            onStop={sc ? () => { setScoring(false); onStopScore(c.id); } : undefined} />
        </Modal>
      )}
    </div>
  );
}

function PreviewTeam({ label, color, slots, players, groupIds, notify, queue, fillQueue, swapOpenId, onSwapClick, onSwap, onSkip, onFill }) {
  const nameOf = (id) => players.find((x) => x.id === id)?.name || "their partner";
  return (
    <div className="team">
      <div className={color}>{label}</div>
      {slots.length ? slots.map(({ idx, p }) => !p ? (
        <div className="chip-wrap" key={`empty-${idx}`}>
          <button className="chip placeholder add-seat" onClick={() => onSwapClick(`empty-${idx}`)}>
            <small><Plus size={13} /> Add player</small>
          </button>
          {swapOpenId === `empty-${idx}` && (
            <div className="swap-menu">
              {fillQueue.length ? fillQueue.map((q) => (
                <button key={q.id} className="swap-item" onClick={() => onFill(idx, q.id)}>
                  {q.name}
                  {q.lockedWithId && <small className="swap-item-lock">locked w/ {nameOf(q.lockedWithId)}</small>}
                </button>
              )) : <div className="swap-empty">No other eligible players waiting.</div>}
            </div>
          )}
        </div>
      ) : (
        <div className="chip-wrap" key={p.id}>
          <div className="chip">
            <div><b>{p.name}{mateName(p, players) && <LockMark name={mateName(p, players)} />}</b><small><StarDisplay value={p.skill} /></small></div>
            <div className="chip-actions">
              <button
                className="chip-btn swap"
                title={p.lockedWithId && groupIds.has(p.lockedWithId) ? `Swap this locked pair (with ${nameOf(p.lockedWithId)})` : "Change player"}
                onClick={() => onSwapClick(p.id)}
              >
                <ArrowLeftRight size={13} />
              </button>
              <button
                className="chip-btn remove"
                title={p.lockedWithId && groupIds.has(p.lockedWithId) ? `Remove this locked pair (with ${nameOf(p.lockedWithId)}); the seats stay empty` : "Remove from this match (goes to the back of the queue; the seat stays empty)"}
                onClick={() => onSkip(p.id, idx)}
              >
                <X size={13} />
              </button>
            </div>
          </div>
          {swapOpenId === p.id && p.lockedWithId && groupIds.has(p.lockedWithId) && (
            <div className="swap-menu">
              {waitingPairs(queue).length ? waitingPairs(queue).map(({ q, mate }) => (
                <button key={q.id} className="swap-item" onClick={() => onSwap(p.id, q.id, idx)}>
                  {q.name} + {mate.name}<small className="swap-item-lock">swaps the locked pair</small>
                </button>
              )) : <div className="swap-empty">No other locked pair is waiting. Remove the pair to put others in.</div>}
            </div>
          )}
          {swapOpenId === p.id && !(p.lockedWithId && groupIds.has(p.lockedWithId)) && (
            <div className="swap-menu">
              {queue.filter((q) => q.id !== p.id).length ? queue.filter((q) => q.id !== p.id).map((q) => (
                <button
                  key={q.id}
                  className="swap-item"
                  onClick={() => {
                    if (q.lockedWithId && !groupIds.has(q.lockedWithId)) {
                      notify(`${q.name} is locked in with ${nameOf(q.lockedWithId)} — can't add them without their partner.`, 4000);
                      return;
                    }
                    onSwap(p.id, q.id, idx);
                  }}
                >
                  {q.name}
                  {q.lockedWithId && (
                    <small className="swap-item-lock">
                      locked w/ {nameOf(q.lockedWithId)}
                    </small>
                  )}
                </button>
              )) : <div className="swap-empty">No other eligible players waiting.</div>}
            </div>
          )}
        </div>
      )) : <div className="chip placeholder"><small>Waiting for players…</small></div>}
    </div>
  );
}

function CourtPreview({ label, level, group, draft, othersTaken, setDraft, need, mode, avoidRepeats, players, queue, notify, onSwapOrder, onSkip, onSendToCourt, canSend }) {
  const [swapOpen, setSwapOpen] = useState(null);
  const teamsRef = useRef(null);
  const toggleSwap = (id) => setSwapOpen((cur) => (cur === id ? null : id));
  const ready = group.length >= need;
  const byId = new Map(players.map((p) => [p.id, p]));
  // Mirror the same team split the match will actually get (splitTeams),
  // so a locked pair previewed here shows on one side, not straddled.
  const [autoA, autoB] = ready ? splitTeams(group, mode, avoidRepeats) : [group.slice(0, Math.ceil(group.length / 2)).map((p) => p.id), group.slice(Math.ceil(group.length / 2)).map((p) => p.id)];
  // Once the host edits this match it becomes a draft of fixed seats: removing a player leaves the seat empty,
  // nobody is inserted and nobody shifts, until the match is sent or the seat is filled.
  const slotIds = draft || (ready ? [...autoA, ...autoB] : null);
  const half = need / 2;
  const seats = (ids) => ids.map((id, i) => ({ idx: i, p: id ? byId.get(id) : null }));
  const slots = slotIds ? seats(slotIds) : null;
  const teamA = slots ? slots.slice(0, half) : seats(autoA);
  const teamB = slots ? slots.slice(half) : seats(autoB).map((x) => ({ ...x, idx: x.idx + autoA.length }));
  const present = (slots || []).filter((x) => x.p);
  const groupIds = new Set(slots ? present.map((x) => x.p.id) : group.map((p) => p.id));
  const filled = Boolean(slots) && present.length === need;
  const eligibleQueue = queue.filter((p) => matchesCourtLevel(p.skill, level) && !groupIds.has(p.id));
  const edit = (ids) => { setDraft(ids); setSwapOpen(null); };
  const current = () => (draft ? [...draft] : [...autoA, ...autoB]);
  const nameOf = (id) => byId.get(id)?.name || "their partner";
  const handleSwap = (oldId, newId, idx) => {
    const ids = current();
    const old = byId.get(oldId);
    const mateIdx = old?.lockedWithId ? ids.indexOf(old.lockedWithId) : -1;
    if (mateIdx >= 0) {
      // A locked pair is swapped for another waiting locked pair, seat for seat.
      const newMate = byId.get(byId.get(newId)?.lockedWithId);
      if (!newMate) return notify(`${old.name} is locked in with ${nameOf(old.lockedWithId)}. Swap them for a locked pair, or remove the pair first.`, 4000);
      onSwapOrder(oldId, newId);
      onSwapOrder(old.lockedWithId, newMate.id);
      ids[idx] = newId; ids[mateIdx] = newMate.id;
      return edit(ids);
    }
    const incoming = byId.get(newId);
    if (incoming?.lockedWithId && !ids.includes(incoming.lockedWithId)) {
      return notify(`${incoming.name} is locked in with ${nameOf(incoming.lockedWithId)}. Swap a locked pair in for a locked pair, or empty two seats and add them both.`, 4500);
    }
    onSwapOrder(oldId, newId); // the newcomer takes the old player's place in the queue, so nothing else moves
    ids[idx] = newId; edit(ids);
  };
  const handleFill = (idx, newId) => {
    const ids = current();
    const incoming = byId.get(newId);
    const mateId = incoming?.lockedWithId;
    if (mateId && !ids.includes(mateId)) {
      // A locked player brings the waiting partner into a second empty seat on the same team.
      const teamStart = idx < half ? 0 : half;
      const other = ids.findIndex((id, i) => !id && i !== idx && i >= teamStart && i < teamStart + half);
      const mate = fillQueue.find((x) => x.id === mateId);
      if (other < 0 || !mate) {
        return notify(`${incoming.name} is locked in with ${nameOf(mateId)}, who needs the other empty seat on this team and must be free to join.`, 4500);
      }
      ids[idx] = newId; ids[other] = mateId;
      return edit(ids);
    }
    ids[idx] = newId; edit(ids);
  };
  const handleSkip = (id, idx) => {
    const ids = current();
    const p = byId.get(id);
    const mateIdx = p?.lockedWithId ? ids.indexOf(p.lockedWithId) : -1;
    ids[idx] = null;
    if (mateIdx >= 0) { ids[mateIdx] = null; onSkip(p.lockedWithId); } // a locked pair leaves together
    edit(ids);
    onSkip(id);
  };
  useCloseSwapOnOutside(teamsRef, swapOpen !== null, () => setSwapOpen(null));
  const fillQueue = eligibleQueue.filter((p) => !othersTaken.has(p.id));
  const shared = { players, groupIds, notify, queue: eligibleQueue, fillQueue, swapOpenId: swapOpen, onSwapClick: toggleSwap, onSwap: handleSwap, onSkip: handleSkip, onFill: handleFill };
  return (
    <div className="court preview">
      <div className="court-top">
        <b>{label}</b>
        {level && level !== "Any Level" && <span className="badge-level-quiet">{level}</span>}
        <span className="badge-next">NEXT</span>
      </div>
      <div className="teams" ref={teamsRef}>
        <PreviewTeam label="Team 1" color="team1" slots={teamA} {...shared} />
        <PreviewTeam label="Team 2" color="team2" slots={teamB} {...shared} />
      </div>
      {slots ? (
        <button
          className="primary preview-send"
          disabled={!canSend || !filled}
          onClick={() => { onSendToCourt(teamA.map((x) => x.p.id), teamB.map((x) => x.p.id)); setDraft(null); }}
        >
          <Play size={14} /> {filled ? "Send to Court" : "Add a player to send"}
        </button>
      ) : (
        <div className="preview-empty-note">Not enough players yet.</div>
      )}
    </div>
  );
}

// Next Up and Match Log are fixed-size lists of this many rows, so the two panels line up.
const LOWER_ROWS = 5;

export default function Dashboard({
  session, players, courts, queue, matchLog, recordWin, removePlayer, swapPlayer, addPlayerToCourt, notify,
  autoRotateOn, onToggleAutoRotate, onAutoFill, onAddCourt, onRemoveCourt, onSetCourtLevel, onRenameCourt,
  onStartNext, onSwapQueueOrder, onSkipQueued, onEditPlayer, onSendToCourt, goQueue, rules,
  claims = [], onScore, onOpenUmpires, claimRecording, onStopScore,
}) {
  const scoreSettings = { style: rules.scoreStyle, to: rules.scoreTo, singles: session.format === "Singles" };
  const need = session.format === "Singles" ? 2 : 4;
  const mode = normalizeMode(session.mode || session.rotation) || "Balanced";
  const manual = mode === "Custom";
  const mixed = mode === "Mixed Doubles";
  const noGender = mixed ? players.filter((p) => p.checked && !hasGender(p)) : [];
  const skippedLocks = ignoredLocks(players, mode);
  const hasOpenCourt = courts.some((c) => (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0);
  const topPlayers = rankPlayers(players).slice(0, 3);
  // Up Next matches the host has edited (fixed seats, see CourtPreview), by court id. A seat whose player is no
  // longer waiting (played, checked out) is emptied rather than refilled.
  const [drafts, setDrafts] = useState({});
  const waiting = new Set(queue.map((p) => p.id));
  const draftOf = (key) => drafts[key]?.map((id) => (id && waiting.has(id) ? id : null));

  // Reserve consecutive, non-overlapping, level-matched slices of the queue:
  // first for any open courts (shown inline via "Start Next Match"), then one
  // per live court for the "Up Next" preview below — so no player, and no
  // level-restricted seat, is double-counted across courts.
  // Players held in an edited (draft) match are reserved first, so no other preview can pick them too.
  // A result seats this court's edited Up Next (when every seat is filled) instead of a fresh pick; then the edit is done.
  const winWithEdit = async (courtId, side, scoreText = null) => {
    const edit = draftOf(courtId);
    if (await recordWin(courtId, side, edit?.every(Boolean) ? edit : null, scoreText)) setDrafts(({ [courtId]: _, ...rest }) => rest);
  };
  // A game the umpire confirmed records itself: the first open Dashboard to claim the court records it (claimRecording
  // is a transaction, so two hosts never record it twice). An Undo of that result keeps the claim, so it doesn't repeat.
  const recording = useRef(new Set());
  useEffect(() => {
    if (!claimRecording) return;
    courts.forEach((c) => {
      const sc = c.score && c.score.start === c.start ? c.score : null;
      const won = sc?.confirmed ? winner(sc) : 0;
      if (!won || c.recordedConfirm === sc.confirmed || recording.current.has(sc.confirmed)) return;
      recording.current.add(sc.confirmed);
      claimRecording(c.id, sc.confirmed)
        .then((mine) => mine && winWithEdit(c.id, won === 1 ? "A" : "B", finalText(sc)))
        .catch(() => {}) // offline or refused: the card keeps its Record button
        .finally(() => recording.current.delete(sc.confirmed));
    });
  }, [courts]); // eslint-disable-line react-hooks/exhaustive-deps
  const held = new Set(courts.flatMap((c) => draftOf(c.id) || []).filter(Boolean));
  const isEmptyCourt = (c) => (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
  const picks = upNextByCourt({
    pool: queue.filter((p) => !held.has(p.id)),
    courts: courts.filter((c) => isEmptyCourt(c) || !draftOf(c.id)), // an edited busy court keeps its own seats
    mode, need, now: Date.now(),
  });
  const courtViews = courts.map((c) => ({ court: c, upNext: isEmptyCourt(c) ? picks[c.id] || [] : [] }));
  // One "Up Next" preview per court, always — so adding/removing a court
  // immediately adds/removes its preview box too. An open court just mirrors
  // the same "ready now" group already shown inline on its own card; a live
  // court previews who rotates in once its current match ends.
  const upcomingPreviews = courtViews.map(({ court: c, upNext: emptyUpNext }) => {
    const isEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
    const label = c.name || `Court ${c.courtNumber}`;
    const draft = draftOf(c.id);
    if (draft) {
      const mine = draft.filter(Boolean);
      return { key: c.id, label, level: c.level, draft, group: mine.map((id) => players.find((p) => p.id === id)) };
    }
    return { key: c.id, label, level: c.level, group: isEmpty ? emptyUpNext : picks[c.id] || [] };
  });

  return (
    <>
      {skippedLocks.length > 0 && (
        <div className="warning gender-banner" role="alert">
          <CircleAlert size={16} />
          <span>
            {skippedLocks.length === 1 ? "1 lock isn't" : `${skippedLocks.length} locks aren't`} used in {mode}
            ({skippedLocks.map(([a, b]) => `${a.name} + ${b.name}`).join(", ")}):{" "}
            {mode === "Mixed Doubles" ? "teams are one man and one woman." : "partners more than one star apart can't get a fair match, so each plays in their own level."}
          </span>
        </div>
      )}
      {noGender.length > 0 && (
        <div className="warning gender-banner" role="alert">
          <CircleAlert size={16} />
          <span>
            {noGender.length === 1 ? "1 player has" : `${noGender.length} players have`} no gender set and won't be picked in Mixed Doubles
            ({noGender.map((p) => p.name).join(", ")}). Set it from the Players tab.
          </span>
        </div>
      )}
      <div className="cards">
        <Stat n={players.length} l="PLAYERS" s="total players" />
        <Stat n={players.filter((p) => p.checked).length} l="CHECKED IN" s="checked in" />
        <Stat n={queue.length} l="WAITING" s="in queue" />
        <Stat n={courts.length} l="COURTS" s="active courts" />
        <div className="stat stat-leaderboard">
          <span>TOP PLAYERS</span>
          <div className="stat-leader-list">
            {topPlayers.length ? topPlayers.map((p, i) => (
              <div className="stat-leader-row" key={p.id}>
                <b className="leaderboard-rank">{i + 1}</b>
                <span className="leaderboard-name">{p.name}</span>
                <small className="leaderboard-win-pct">{p.wins || 0} won · {winPct(p)}%</small>
              </div>
            )) : <small className="leaderboard-empty">No players yet</small>}
          </div>
        </div>
      </div>

      <div className="heading">
        <div><h2>Live Courts</h2><p>{manual ? "Custom mode: record a winner to clear the court, then build the next match yourself." : "Record a winner to rotate the completed players."}</p></div>
        <div className="heading-actions">
          <button className="outline" onClick={onOpenUmpires}><UserCheck size={14} /> Umpires</button>
          <button className="outline" onClick={onAddCourt} disabled={courts.length >= 8}>
            <Plus size={14} /> Add Court
          </button>
          {!manual && (
            <>
              <button className="outline" onClick={onAutoFill}><Zap size={14} /> Auto-fill</button>
              <button
                className={`pill toggle ${autoRotateOn ? "" : "off"}`}
                onClick={onToggleAutoRotate}
                title="Toggle automatic queue rotation on court wins"
              >
                {autoRotateOn ? "●" : "○"} Auto<span className="label-full">-rotation</span> {autoRotateOn ? "ON" : "OFF"}
              </button>
            </>
          )}
        </div>
      </div>
      <div className="courts">
        {courtViews.map(({ court: c, upNext }) => (
          <Court key={c.id} c={c} players={players} queue={queue} need={need} upNext={upNext}
            win={winWithEdit} remove={removePlayer} swap={swapPlayer} addPlayer={addPlayerToCourt} onStartNext={onStartNext} onSetLevel={onSetCourtLevel}
            onRemoveCourt={onRemoveCourt} canRemove={courts.length > 1} onRenameCourt={onRenameCourt}
            alertAfterMin={rules.gameAlertMinutes} manual={manual}
            claims={claims} scoreSettings={scoreSettings} onScore={onScore} onStopScore={onStopScore} />
        ))}
      </div>

      {upcomingPreviews.length > 0 && !manual && (
        <>
          <div className="heading">
            <div><h2>Up Next</h2><p>Preview of who rotates onto each court next.</p></div>
          </div>
          <div className="courts">
            {upcomingPreviews.map((pv) => (
              <CourtPreview key={pv.key} label={pv.label} level={pv.level} group={pv.group} draft={pv.draft} othersTaken={new Set(upcomingPreviews.filter((o) => o !== pv).flatMap((o) => o.group.map((p) => p.id)))} setDraft={(d) => setDrafts((cur) => ({ ...cur, [pv.key]: d }))} need={need} mode={mode} avoidRepeats={rules.avoidRepeatPartners} players={players} queue={queue}
                notify={notify} onSwapOrder={onSwapQueueOrder} onSkip={onSkipQueued} onSendToCourt={onSendToCourt} canSend={hasOpenCourt} />
            ))}
          </div>
        </>
      )}

      <div className="lower">
        <div className="panel">
          <PanelHead title="Next Up" sub="Priority follows fewer games + wait time." button="View queue →" action={goQueue} />
          {Array.from({ length: LOWER_ROWS }, (_, i) => queue[i]).map((p, i) => !p ? (
            <div className="next empty-slot" key={`open-${i}`}>
              <strong>{i + 1}</strong>
              <span>Open spot</span>
            </div>
          ) : (
            <div className="next" key={p.id}>
              <strong>{i + 1}</strong>
              <PersonBadge name={p.name} warn={mixed && !hasGender(p) ? "Set gender to play Mixed Doubles" : null}
                lock={players.find((x) => x.id === p.lockedWithId)?.name}>
                <div className="next-meta">
                  <StarDisplay value={p.skill} />
                  <span className="queue-stat games">{p.games} <small>games</small></span>
                  <span className="queue-stat wins">{p.wins} <small>wins</small></span>
                  <span className="queue-stat losses">{p.losses || 0} <small>losses</small></span>
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
            ? matchLog.slice(0, LOWER_ROWS).map((m, i) => <MatchLogRow match={m} latest={i === 0} key={m.id} />)
            : <div className="empty">No matches recorded yet.</div>}
        </div>
      </div>
    </>
  );
}
