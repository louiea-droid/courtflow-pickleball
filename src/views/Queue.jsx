import { useState } from "react";
import { Link2 } from "lucide-react";
import PersonBadge from "../components/PersonBadge";
import StarDisplay from "../components/StarDisplay";
import { waitMinutes, formatTime } from "../utils/format";

export default function Queue({ queue, notCheckedIn, players, onCall, onCheckOut, onCheckIn, onSetLock }) {
  const [pendingLockId, setPendingLockId] = useState(null);
  const nameOf = (id) => players?.find((p) => p.id === id)?.name || "player";
  const pendingName = pendingLockId ? nameOf(pendingLockId) : null;

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
          Choose who to lock in with <b>{pendingName}</b>.{" "}
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
            <PersonBadge name={p.name}>
              {p.lockedWithId && (
                <small className="lock-chip"><Link2 size={11} /> <span>{nameOf(p.lockedWithId)}</span></small>
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

      <h3 className="section-title">Not Checked In<span className="count-badge">{notCheckedIn.length}</span></h3>
      <p className="section-hint">Waiting to arrive — check them in when they show up. For full stats or to edit a player, use the Players tab.</p>
      <div className="panel checkin-list">
        {notCheckedIn.map((p, i) => (
          <div className="checkin-item" key={p.id} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            <PersonBadge name={p.name} skill={p.skill} />
            <button className="tiny accent" onClick={() => onCheckIn(p.id)}>Check In</button>
          </div>
        ))}
        {!notCheckedIn.length && <div className="empty">Everyone is checked in.</div>}
      </div>
    </>
  );
}
