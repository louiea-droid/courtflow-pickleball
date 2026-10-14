import { useState } from "react";
import { LayoutGrid, List, Pencil, Trash2, Link2 } from "lucide-react";
import PersonBadge from "../components/PersonBadge";
import { winPct } from "../utils/format";
import { hasGender, validLock } from "../utils/rotationModes";

const VIEW_KEY = "courtflow.playersView";
const savedView = () => { try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards"; } catch { return "cards"; } };

export default function Players({ players, mixed, onEdit, onDelete }) {
  const [view, setView] = useState(savedView);
  const chooseView = (next) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* private window: the choice just isn't remembered */ }
  };
  const handleDelete = (p) => {
    if (window.confirm(`Remove ${p.name} from the roster? This cannot be undone.`)) {
      onDelete(p.id);
    }
  };
  const nameOf = (id) => players.find((p) => p.id === id)?.name;
  const badLock = (p) => mixed && p.lockedWithId && !validLock(p, players.find((q) => q.id === p.lockedWithId), "Mixed Doubles");

  const warnOf = (p) => (mixed && !hasGender(p) ? "Set gender to play Mixed Doubles" : null);
  const lockBadge = (p) => p.lockedWithId && (
    <em className={`locked${badLock(p) ? " bad" : ""}`}>
      <Link2 size={11} /> Locked with {nameOf(p.lockedWithId) || "player"}{badLock(p) ? " (ignored in Mixed Doubles)" : ""}
    </em>
  );
  const actions = (p) => (
    <div className="playercard-actions">
      <button className="icon" title="Edit player" aria-label={`Edit ${p.name}`} onClick={() => onEdit(p)}><Pencil size={14} /></button>
      <button className="icon danger" title="Remove player" aria-label={`Remove ${p.name}`} onClick={() => handleDelete(p)}><Trash2 size={14} /></button>
    </div>
  );

  return (
    <>
      {players.length > 0 && (
        <div className="view-toggle" role="group" aria-label="Show players as">
          <button type="button" aria-pressed={view === "cards"} onClick={() => chooseView("cards")}><LayoutGrid size={14} /> Cards</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => chooseView("list")}><List size={14} /> List</button>
        </div>
      )}
      {players.length && view === "list" ? (
        <div className="panel players-list">
          <div className="player-row header" aria-hidden="true">
            <span>Player</span><span>Games</span><span>Wins</span><span>Losses</span><span>Win %</span><span>Status</span><span />
          </div>
          {players.map((p) => (
            <div className="player-row" key={p.id}>
              <PersonBadge name={p.name} skill={p.skill} warn={warnOf(p)} />
              <div className="pr-stats">
                <span data-label="Games">{p.games}</span>
                <span data-label="Wins">{p.wins}</span>
                <span data-label="Losses">{p.losses || 0}</span>
                <span data-label="Win %">{winPct(p)}%</span>
              </div>
              <span className="pr-status"><em className="status">{p.checked ? "Checked in" : "Checked out"}</em>{lockBadge(p)}</span>
              {actions(p)}
            </div>
          ))}
        </div>
      ) : players.length ? (
        <div className="playergrid">
          {players.map((p, i) => (
            <div className="playercard" key={p.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <div className="playercard-head">
                <PersonBadge name={p.name} skill={p.skill} size="lg" warn={warnOf(p)} />
                {actions(p)}
              </div>
              <div className="ministats">
                <div><span>Games</span><b>{p.games}</b></div>
                <div><span>Wins</span><b>{p.wins}</b></div>
                <div><span>Losses</span><b>{p.losses || 0}</b></div>
                <div><span>Win %</span><b>{winPct(p)}%</b></div>
              </div>
              <div className="playercard-badges">
                <em className="status">{p.checked ? "Checked in" : "Checked out"}</em>
                {lockBadge(p)}
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
