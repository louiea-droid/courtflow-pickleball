import { Plus } from "lucide-react";
import StarDisplay from "../components/StarDisplay";
import { initials, waitMinutes, formatPHTime } from "../utils/format";

export default function Queue({ queue, notCheckedIn, onAdd, onCall, onCheckOut, onCheckIn }) {
  return (
    <>
      <div className="heading">
        <div><h2>Player Queue</h2><p>Waiting order is synchronized through Firestore.</p></div>
        <button className="primary" onClick={onAdd}><Plus /> Add Player</button>
      </div>
      <div className="panel table">
        <div className="row header">
          <span>#</span><span>Player</span><span>Skill</span><span>Games</span><span>W/L</span><span>Wait</span><span />
        </div>
        {queue.map((p, i) => (
          <div className="row" key={p.id} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            <span>{i + 1}</span>
            <span className="person"><i>{initials(p.name)}</i><b>{p.name}</b></span>
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
      <div className="panel table">
        <div className="row header">
          <span>#</span><span>Player</span><span>Skill</span><span>Games</span><span /><span /><span />
        </div>
        {notCheckedIn.map((p, i) => (
          <div className="row" key={p.id} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            <span>{i + 1}</span>
            <span className="person"><i>{initials(p.name)}</i><b>{p.name}</b></span>
            <span><StarDisplay value={p.skill} /></span>
            <span>{p.games}</span>
            <span /><span />
            <span className="row-actions">
              <button className="tiny accent" onClick={() => onCheckIn(p.id)}>Check In</button>
            </span>
          </div>
        ))}
        {!notCheckedIn.length && <div className="empty">Everyone is checked in.</div>}
      </div>
    </>
  );
}
