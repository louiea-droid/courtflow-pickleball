import PersonBadge from "../components/PersonBadge";
import StarDisplay from "../components/StarDisplay";
import { waitMinutes, formatPHTime } from "../utils/format";

export default function Queue({ queue, notCheckedIn, onCall, onCheckOut, onCheckIn }) {
  return (
    <>
      <div className="panel table">
        <div className="row header">
          <span>#</span><span>Player</span><span>Skill</span><span>Games</span><span>W/L</span><span>Wait</span><span />
        </div>
        {queue.map((p, i) => (
          <div className="row" key={p.id} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            <span>{i + 1}</span>
            <PersonBadge name={p.name}>
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
            <span className="wait-cell"><b>{waitMinutes(p)} min</b><small>since {formatPHTime(p.checkedAt)}</small></span>
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
