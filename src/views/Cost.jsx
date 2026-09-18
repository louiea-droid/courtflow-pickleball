import { useState } from "react";
import { Check, ChevronDown, MonitorPlay, Save, Trash2 } from "lucide-react";
import PanelHead from "../components/PanelHead";
import PersonBadge from "../components/PersonBadge";
import { formatPHDate, money } from "../utils/format";

function CostEntry({ entry, players, onTogglePaid, onToggleLive, onDelete }) {
  const [open, setOpen] = useState(false);
  const roster = entry.playerIds
    .map((id) => players.find((p) => p.id === id) || { id, name: "Removed player" });
  const paidCount = entry.playerIds.filter((id) => entry.paid?.[id]).length;
  const allSettled = paidCount === entry.playerIds.length;

  return (
    <div className="history-entry">
      <button className="history-entry-head" onClick={() => setOpen((o) => !o)}>
        <div>
          <b>{entry.label} · {formatPHDate(entry.createdAt)}</b>
          <small>
            {money(entry.total)} total ({entry.courts} court{entry.courts === 1 ? "" : "s"}) · {money(entry.perPerson)} / player
          </small>
        </div>
        <div className="history-entry-badges">
          {entry.visibleOnLive && <span className="badge-open">LIVE</span>}
          <span className={`pill settle-badge ${allSettled ? "" : "off"}`}>
            {allSettled ? "Settled" : `${paidCount}/${entry.playerIds.length} paid`}
          </span>
        </div>
        <ChevronDown size={15} className={open ? "rot" : ""} />
      </button>
      {open && (
        <div className="history-entry-body">
          {roster.map((p) => (
            <div className="cost-row" key={p.id}>
              <PersonBadge name={p.name} />
              <b>{money(entry.perPerson)}</b>
              <button
                className={`pill toggle ${entry.paid?.[p.id] ? "" : "off"}`}
                onClick={() => onTogglePaid(entry.id, p.id)}
              >
                {entry.paid?.[p.id] ? "● Paid" : "○ Unpaid"}
              </button>
            </div>
          ))}
          <div className="cost-actions">
            <button
              className={`pill toggle ${entry.visibleOnLive ? "" : "off"}`}
              onClick={() => onToggleLive(entry.id)}
            >
              <MonitorPlay size={12} /> {entry.visibleOnLive ? "On Live Board" : "Show on Live Board"}
            </button>
            <button className="tiny danger" onClick={() => onDelete(entry.id)}>
              <Trash2 size={12} /> Remove entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Cost({ players, costs, onAdd, onTogglePaid, onToggleLive, onDelete }) {
  const [label, setLabel] = useState("");
  const [rate, setRate] = useState("");
  const [hours, setHours] = useState("");
  const [courtCount, setCourtCount] = useState("1");
  const [selected, setSelected] = useState(() => players.filter((p) => p.checked).map((p) => p.id));

  const rateNum = parseFloat(rate) || 0;
  const hoursNum = parseFloat(hours) || 0;
  const courtsNum = parseFloat(courtCount) || 0;
  const total = rateNum * hoursNum * courtsNum;
  const perPerson = selected.length ? total / selected.length : 0;
  const canSave = rateNum > 0 && hoursNum > 0 && courtsNum > 0 && selected.length > 0;

  const allSelected = players.length > 0 && selected.length === players.length;

  const toggleSelected = (id) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? [] : players.map((p) => p.id));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    onAdd({ label: label.trim(), rate: rateNum, hours: hoursNum, courts: courtsNum, playerIds: selected });
    setLabel(""); setRate(""); setHours(""); setCourtCount("1");
    setSelected(players.filter((p) => p.checked).map((p) => p.id));
  };

  return (
    <>
      <div className="panel cost-form">
      
        <form onSubmit={submit}>
          <label>
            Court / label
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Court 1" />
          </label>

          <div className="cost-calc-grid">
            <label>
              Rate ($ / hr)
              <input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" />
            </label>
            <label>
              Hours
              <input type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1" />
            </label>
            <label>
              Courts rented
              <input type="number" min="1" step="1" value={courtCount} onChange={(e) => setCourtCount(e.target.value)} placeholder="1" />
            </label>
          </div>

          <div className="cost-select-head">
            <label>Splitting between</label>
            {players.length > 0 && (
              <button type="button" className="text" onClick={toggleSelectAll}>
                {allSelected ? "Clear all" : "Select all"}
              </button>
            )}
          </div>
          <div className="player-select">
            {players.map((p) => (
              <button
                type="button"
                key={p.id}
                className={`player-chip ${selected.includes(p.id) ? "selected" : ""}`}
                onClick={() => toggleSelected(p.id)}
              >
                <PersonBadge name={p.name} />
                {selected.includes(p.id) && <Check size={14} />}
              </button>
            ))}
            {!players.length && <span className="section-hint">Add players first, then come back here.</span>}
          </div>

          <div className="cards cost-preview">
            <div className="stat"><span>TOTAL</span><b>{money(total)}</b><small>rate × hours × courts</small></div>
            <div className="stat"><span>PER PLAYER</span><b>{money(perPerson)}</b><small>{selected.length || 0} splitting</small></div>
          </div>

          <div className="modalactions">
            <button className="primary" disabled={!canSave}><Save size={14} /> Save Entry</button>
          </div>
        </form>
      </div>

      <div className="panel history-panel">
        <PanelHead title="Rental History" sub="Everyone's split, and who still owes." />
        {costs.map((entry) => (
          <CostEntry
            key={entry.id} entry={entry} players={players}
            onTogglePaid={onTogglePaid} onToggleLive={onToggleLive} onDelete={onDelete}
          />
        ))}
        {!costs.length && <div className="empty">No court rentals logged yet.</div>}
      </div>
    </>
  );
}
