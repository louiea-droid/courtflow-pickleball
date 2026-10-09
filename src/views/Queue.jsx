import { useState } from "react";
import { Link2, Search, X } from "lucide-react";
import PersonBadge from "../components/PersonBadge";
import StarDisplay from "../components/StarDisplay";
import { waitMinutes, formatTime } from "../utils/format";
import { hasGender, validLock } from "../utils/rotationModes";

const NO_GENDER = "Set gender to play Mixed Doubles";

export default function Queue({ queue, notCheckedIn, players, mixed, onCall, onCheckOut, onCheckIn, onSetLock }) {
  const [pendingLockId, setPendingLockId] = useState(null);
  const [checkInSearch, setCheckInSearch] = useState("");
  const nameOf = (id) => players?.find((p) => p.id === id)?.name || "player";
  const pendingName = pendingLockId ? nameOf(pendingLockId) : null;
  const warnOf = (p) => (mixed && !hasGender(p) ? NO_GENDER : null);
  const normalizedCheckInSearch = checkInSearch.trim().toLowerCase();
  const visibleNotCheckedIn = normalizedCheckInSearch
    ? notCheckedIn.filter((p) => p.name.toLowerCase().includes(normalizedCheckInSearch))
    : notCheckedIn;
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
                <Link2 size={12} />
                {p.lockedWithId ? "Unlock" : pendingLockId === p.id ? "Cancel" : pendingLockId ? "Pair here" : "Lock In"}
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

      <div className="checkin-heading">
        <h3 className="section-title">Not Checked In<span className="count-badge">{notCheckedIn.length}</span></h3>
        {notCheckedIn.length > 0 && (
          <label className="checkin-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search players not checked in"
              placeholder="Search players"
              value={checkInSearch}
              onChange={(event) => setCheckInSearch(event.target.value)}
            />
            {checkInSearch && (
              <button
                type="button"
                className="checkin-search-clear"
                aria-label="Clear player search"
                onClick={() => setCheckInSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </label>
        )}
      </div>
      <p className="section-hint">Waiting to arrive — check them in when they show up. For full stats or to edit a player, use the Players tab.</p>
      <div className="panel checkin-list">
        {visibleNotCheckedIn.map((p, i) => (
          <div className="checkin-item" key={p.id} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            <PersonBadge name={p.name} skill={p.skill} warn={warnOf(p)} />
            <button className="tiny accent" onClick={() => onCheckIn(p.id)}>Check In</button>
          </div>
        ))}
        {!notCheckedIn.length && <div className="empty">Everyone is checked in.</div>}
        {notCheckedIn.length > 0 && !visibleNotCheckedIn.length && (
          <div className="empty checkin-no-results" role="status">No players match “{checkInSearch.trim()}”.</div>
        )}
      </div>
    </>
  );
}
