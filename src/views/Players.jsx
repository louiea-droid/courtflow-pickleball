import { Pencil, Trash2, Link2 } from "lucide-react";
import PersonBadge from "../components/PersonBadge";
import { winPct } from "../utils/format";

export default function Players({ players, onEdit, onDelete }) {
  const handleDelete = (p) => {
    if (window.confirm(`Remove ${p.name} from the roster? This cannot be undone.`)) {
      onDelete(p.id);
    }
  };
  const nameOf = (id) => players.find((p) => p.id === id)?.name;

  return (
    <>
      {players.length ? (
        <div className="playergrid">
          {players.map((p, i) => (
            <div className="playercard" key={p.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <div className="playercard-head">
                <PersonBadge name={p.name} skill={p.skill} size="lg" />
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
              <div className="playercard-badges">
                <em className="status">{p.checked ? "Checked in" : "Checked out"}</em>
                {p.lockedWithId && (
                  <em className="locked"><Link2 size={11} /> Locked with {nameOf(p.lockedWithId) || "player"}</em>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">No players yet. Add your first player to get started.</div>
      )}
    </>
  );
}
