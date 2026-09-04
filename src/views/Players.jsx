import { Plus, Pencil, Trash2 } from "lucide-react";
import StarDisplay from "../components/StarDisplay";
import { initials, winPct } from "../utils/format";

export default function Players({ players, onAdd, onEdit, onDelete }) {
  const handleDelete = (p) => {
    if (window.confirm(`Remove ${p.name} from the roster? This cannot be undone.`)) {
      onDelete(p.id);
    }
  };

  return (
    <>
      <div className="heading">
        <div><h2>Players</h2><p>Current session roster and performance.</p></div>
        <button className="primary" onClick={onAdd}><Plus /> Add Player</button>
      </div>
      {players.length ? (
        <div className="playergrid">
          {players.map((p, i) => (
            <div className="playercard" key={p.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <div className="playercard-head">
                <div className="person big"><i>{initials(p.name)}</i><div><b>{p.name}</b><small><StarDisplay value={p.skill} /></small></div></div>
                <div className="playercard-actions">
                  <button className="icon" title="Edit player" onClick={() => onEdit(p)}><Pencil size={14} /></button>
                  <button className="icon danger" title="Remove player" onClick={() => handleDelete(p)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="ministats">
                <div><span>Games</span><b>{p.games}</b></div>
                <div><span>Wins</span><b>{p.wins}</b></div>
                <div><span>Win %</span><b>{winPct(p)}%</b></div>
              </div>
              <em>{p.checked ? "Checked in" : "Checked out"}</em>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No players yet. Add your first player to get started.</div>
      )}
    </>
  );
}
