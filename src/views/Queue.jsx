import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Link2, Search, UserCheck, X } from "lucide-react";
import Modal from "../components/Modal";
import PersonBadge from "../components/PersonBadge";
import StarDisplay from "../components/StarDisplay";
import { waitMinutes, formatTime } from "../utils/format";
import { isValidSkillLevel, skillLevelLabel } from "../utils/courtLevels";
import { hasGender, validLock } from "../utils/rotationModes";

const NO_GENDER = "Set gender to play Mixed Doubles";

export default function Queue({ queue, notCheckedIn, players, mixed, onCall, onCheckOut, onCheckIn, onSetLock }) {
  const [pendingLockId, setPendingLockId] = useState(null);
  const [checkInSearch, setCheckInSearch] = useState("");
  const [showCheckIn, setShowCheckIn] = useState(false);
  // A player who just got checked in stays in the modal list for a moment as a "Checked in" row, then slides away.
  const [leaving, setLeaving] = useState([]);
  const lastWaiting = useRef(notCheckedIn);
  useEffect(() => {
    const still = new Set(notCheckedIn.map((p) => p.id));
    const gone = lastWaiting.current.map((p, index) => ({ p, index })).filter(({ p }) => !still.has(p.id));
    lastWaiting.current = notCheckedIn;
    if (!gone.length) return;
    setLeaving((cur) => [...cur, ...gone]);
    setTimeout(() => setLeaving((cur) => cur.filter((g) => !gone.some((x) => x.p.id === g.p.id))), 1100);
  }, [notCheckedIn]);
  const nameOf = (id) => players?.find((p) => p.id === id)?.name || "player";
  const pendingName = pendingLockId ? nameOf(pendingLockId) : null;
  const warnOf = (p) => (mixed && !hasGender(p) ? NO_GENDER : null);
  const normalizedCheckInSearch = checkInSearch.trim().toLowerCase();
  const visibleNotCheckedIn = normalizedCheckInSearch
    ? notCheckedIn.filter((p) => p.name.toLowerCase().includes(normalizedCheckInSearch))
    : notCheckedIn;
  const rowsInModal = visibleNotCheckedIn.map((p) => ({ p }));
  leaving
    .filter(({ p }) => !normalizedCheckInSearch || p.name.toLowerCase().includes(normalizedCheckInSearch))
    .forEach((g) => rowsInModal.splice(Math.min(g.index, rowsInModal.length), 0, { ...g, done: true }));
  // A saved lock the Mixed Doubles rule ignores (two men, two women, or no gender set).
  const badLock = (p) => mixed && p.lockedWithId && !validLock(p, players?.find((q) => q.id === p.lockedWithId), "Mixed Doubles");

  const handleLockClick = (p) => {
    if (p.lockedWithId) {
      onSetLock(p.id, null);
      if (pendingLockId === p.id) setPendingLockId(null);
      return;
    }
    if (pendingLockId === p.id) {
      setPendingLockId(null);
    } else if (pendingLockId) {
      onSetLock(pendingLockId, p.id);
      setPendingLockId(null);
    } else {
      setPendingLockId(p.id);
    }
  };

  return (
    <>
      <div className="queue-toolbar">
        <button type="button" className="outline" data-tour="checkin" onClick={() => setShowCheckIn(true)}>
          <UserCheck size={15} /> Not Checked In<span className="count-badge">{notCheckedIn.length}</span>
        </button>
      </div>
      {pendingLockId && (
        <div className="section-hint lock-hint">
          Choose who to lock in with <b>{pendingName}</b>.{mixed && " Mixed Doubles: pick the opposite gender."}{" "}
          <button className="linklike" onClick={() => setPendingLockId(null)}>Cancel</button>
        </div>
      )}
      <div className="panel table">
        <div className="row header">
          <span>#</span><span>Player</span><span>Skill</span><span>Games</span><span>W/L</span><span>Wait</span><span /><span />
        </div>
        {queue.map((p, i) => (
          <div className="row" key={p.id} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            <span>{i + 1}</span>
            <PersonBadge name={p.name} warn={warnOf(p)}>
              {p.lockedWithId && (
                <small className={`lock-chip${badLock(p) ? " bad" : ""}`} title={badLock(p) ? "Ignored in Mixed Doubles: lock a man with a woman" : undefined}>
                  <Link2 size={11} /> <span>{nameOf(p.lockedWithId)}{badLock(p) ? " (ignored)" : ""}</span>
                </small>
              )}
              <span className="row-meta">
                <StarDisplay value={p.skill} />
                <span>{p.games}g</span>
                <span>{p.wins}/{p.losses}</span>
                <span>{waitMinutes(p)}m</span>
              </span>
            </PersonBadge>
            <span><StarDisplay value={p.skill} /></span>
            <span>{p.games}</span>
            <span>{p.wins}/{p.losses}</span>
            <span className="wait-cell"><b>{waitMinutes(p)} min</b><small>since {formatTime(p.checkedAt)}</small></span>
            <span>
              <button
                className={`tiny lock-btn ${p.lockedWithId ? "active" : ""} ${pendingLockId === p.id ? "pending" : ""}`}
                title={p.lockedWithId ? `Locked with ${nameOf(p.lockedWithId)} — click to unlock` : "Lock in with another player"}
                onClick={() => handleLockClick(p)}
              >
                <Link2 size={12} aria-hidden="true" />
                {/* the words hide on a phone (icon only); the color still shows the state */}
                <span className="lock-label">{p.lockedWithId ? "Unlock" : pendingLockId === p.id ? "Cancel" : pendingLockId ? "Pair here" : "Lock In"}</span>
              </button>
            </span>
            <span className="row-actions">
              <button className="tiny" onClick={() => onCall(p.id)}>Call</button>
              <button className="tiny danger" onClick={() => onCheckOut(p.id)}>Check Out</button>
            </span>
          </div>
        ))}
        {!queue.length && <div className="empty">Queue is empty.</div>}
      </div>

      {showCheckIn && (
        <Modal title="Not Checked In" label={`${notCheckedIn.length} waiting`} close={() => setShowCheckIn(false)} className="checkin-modal">
          {notCheckedIn.length > 0 && (
            <label className="checkin-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search" autoFocus aria-label="Search players not checked in" placeholder={`Search ${notCheckedIn.length} ${notCheckedIn.length === 1 ? "player" : "players"}`}
                value={checkInSearch} onChange={(event) => setCheckInSearch(event.target.value)}
              />
              {checkInSearch && (
                <button type="button" className="checkin-search-clear" aria-label="Clear player search" onClick={() => setCheckInSearch("")}>
                  <X size={14} />
                </button>
              )}
            </label>
          )}
          <div className="checkin-list checkin-modal-list">
            {rowsInModal.map(({ p, done }) => (
              <div className={`checkin-item${done ? " leaving" : ""}`} key={p.id}>
                <span className="ci-who">
                  <b className="ci-name">
                    {p.name}
                    {warnOf(p) && <span className="gender-warn" role="img" title={warnOf(p)} aria-label={warnOf(p)}><CircleAlert size={13} /></span>}
                  </b>
                  {isValidSkillLevel(p.skill) ? (
                    <span className="ci-skill"><StarDisplay value={p.skill} /> {skillLevelLabel(p.skill)}</span>
                  ) : (
                    <span className="ci-skill unrated">Not rated yet</span>
                  )}
                </span>
                {done ? (
                  <span className="ci-btn ci-done"><Check size={16} strokeWidth={3} /> Checked in</span>
                ) : (
                  <button className="ci-btn" aria-label={`Check in ${p.name}`} onClick={() => onCheckIn(p.id)}>Check in</button>
                )}
              </div>
            ))}
            {!notCheckedIn.length && !leaving.length && <div className="empty">Everyone is checked in.</div>}
            {notCheckedIn.length > 0 && !visibleNotCheckedIn.length && (
              <div className="empty checkin-no-results" role="status">No players match “{checkInSearch.trim()}”.</div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
