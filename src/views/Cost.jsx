import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, MonitorPlay, Save, Trash2 } from "lucide-react";
import PanelHead from "../components/PanelHead";
import PersonBadge from "../components/PersonBadge";
import { splitAttendees } from "../utils/bookings";
import { formatDate, money, splitCost } from "../utils/format";

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
          <b>{entry.label} · {formatDate(entry.createdAt)}</b>
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

function OpenPlayFeeRow({ attendee, fee, onSetPaid, due = true }) {
  const paid = attendee.paid === "paid";
  const refunded = attendee.paid === "refunded";
  return (
    <div className="open-play-fee-row">
      <PersonBadge name={attendee.name} />
      <b>{due ? money(fee) : "Not due"}</b>
      <button
        type="button"
        className={`pill toggle ${paid ? "" : "off"}`}
        aria-label={`Mark ${attendee.name} ${paid ? "unpaid" : "paid"}`}
        onClick={() => onSetPaid(attendee.id, paid ? "unpaid" : "paid")}
      >
        {paid ? "Mark unpaid" : refunded ? "Mark unpaid" : "Mark paid"}
      </button>
    </div>
  );
}

function OpenPlayFees({ attendees, fee, maxPlayers, onSetPaid }) {
  const { confirmed } = splitAttendees({ attendees, maxPlayers });
  const confirmedIds = new Set(confirmed.map((a) => a.id));
  const unpaid = attendees.filter((a) => confirmedIds.has(a.id) && a.paid !== "paid" && a.paid !== "refunded");
  const waitlist = attendees.filter((a) => !confirmedIds.has(a.id) && a.paid !== "paid" && a.paid !== "refunded");
  const paid = attendees.filter((a) => a.paid === "paid");
  const refunded = attendees.filter((a) => a.paid === "refunded");
  return (
    <div className="panel open-play-fees">
      <PanelHead title="Open Play fees" sub={`${money(fee)} per player, using this event's set fee.`} />
      <div className="open-play-fee-summary">
        <div><span>STILL OWED</span><b>{money(unpaid.length * fee)}</b><small>{unpaid.length} unpaid</small></div>
        <div><span>COLLECTED</span><b>{money(paid.length * fee)}</b><small>{paid.length} paid</small></div>
      </div>
      <div className="booking-block">
        <h4>Unpaid <span className="count-badge">{unpaid.length}</span></h4>
        {unpaid.map((a) => <OpenPlayFeeRow key={a.id} attendee={a} fee={fee} onSetPaid={onSetPaid} />)}
        {!unpaid.length && <div className="empty">Everyone has paid.</div>}
      </div>
      {paid.length > 0 && (
        <div className="booking-block">
          <h4>Paid (including waitlist) <span className="count-badge">{paid.length}</span></h4>
          {paid.map((a) => <OpenPlayFeeRow key={a.id} attendee={a} fee={fee} onSetPaid={onSetPaid} />)}
        </div>
      )}
      {waitlist.length > 0 && (
        <div className="booking-block">
          <h4>Waitlist · not yet due <span className="count-badge">{waitlist.length}</span></h4>
          {waitlist.map((a) => <OpenPlayFeeRow key={a.id} attendee={a} fee={fee} onSetPaid={onSetPaid} due={false} />)}
        </div>
      )}
      {refunded.length > 0 && (
        <div className="booking-block">
          <h4>Refunded <span className="count-badge">{refunded.length}</span></h4>
          {refunded.map((a) => <OpenPlayFeeRow key={a.id} attendee={a} fee={fee} onSetPaid={onSetPaid} />)}
        </div>
      )}
      {!attendees.length && <div className="empty">Add players to this Open Play to track their fees.</div>}
    </div>
  );
}

export default function Cost({
  players, costs, costDefaults, onAdd, onTogglePaid, onToggleLive, onDelete,
  isOpenPlay, attendees = [], eventFee = 0, maxPlayers, onSetAttendeePaid,
}) {
  const defaultRate = costDefaults.rate ? String(costDefaults.rate) : "";
  const [label, setLabel] = useState("");
  const [rate, setRate] = useState(defaultRate);
  const [hours, setHours] = useState("");
  const [courtCount, setCourtCount] = useState("1");
  const [selected, setSelected] = useState(() => players.filter((p) => p.checked).map((p) => p.id));
  const previousSelectable = useRef(new Set());

  const rateNum = parseFloat(rate) || 0;
  const hoursNum = parseFloat(hours) || 0;
  const courtsNum = parseFloat(courtCount) || 0;
  const tracksOpenPlayFee = isOpenPlay && eventFee > 0;
  const selectablePlayers = players;
  const selectableKey = selectablePlayers.map((p) => p.id).join("\u0000");
  useEffect(() => {
    const selectableIds = new Set(selectablePlayers.map((p) => p.id));
    const newlySelectable = selectablePlayers
      .filter((p) => !previousSelectable.current.has(p.id) && p.checked)
      .map((p) => p.id);
    setSelected((current) => [...new Set([
      ...current.filter((id) => selectableIds.has(id)),
      ...newlySelectable,
    ])]);
    previousSelectable.current = selectableIds;
  }, [selectableKey]);

  const total = rateNum * hoursNum * courtsNum;
  const perPerson = splitCost(total, selected.length, isOpenPlay ? 0 : costDefaults.roundTo);
  const canSave = rateNum > 0 && hoursNum > 0 && courtsNum > 0 && selected.length > 0;

  const allSelected = selectablePlayers.length > 0 && selected.length === selectablePlayers.length;

  const toggleSelected = (id) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const toggleSelectAll = () => {
    setSelected(allSelected ? [] : selectablePlayers.map((p) => p.id));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!canSave) return;
    onAdd({
      label: label.trim(), rate: rateNum, hours: hoursNum, courts: courtsNum,
      playerIds: selected, perPerson,
    });
    setLabel(""); setRate(defaultRate); setHours(""); setCourtCount("1");
    setSelected(selectablePlayers.filter((p) => p.checked).map((p) => p.id));
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
              Rate (₱ / hr)
              <input type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" />
            </label>
            <label>
              Hours
              <input type="number" min="0" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1" />
            </label>
            <label>
              Courts
              <input type="number" min="1" step="1" value={courtCount} onChange={(e) => setCourtCount(e.target.value)} placeholder="1" />
            </label>
          </div>

          <div className="cost-select-head">
            <label>Splitting between</label>
            {selectablePlayers.length > 0 && (
              <button type="button" className="text" onClick={toggleSelectAll}>
                {allSelected ? "Clear all" : "Select all"}
              </button>
            )}
          </div>
          <div className="player-select">
            {selectablePlayers.map((p) => (
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
            {!selectablePlayers.length && <span className="section-hint">Add players first, then come back here.</span>}
          </div>

          <div className="cards cost-preview">
            <div className="stat"><span>TOTAL</span><b>{money(total)}</b><small>rate × hours × courts</small></div>
            <div className="stat">
              <span>PER PLAYER</span>
              <b>{money(perPerson)}</b>
              <small>{`${selected.length || 0} splitting${!isOpenPlay && costDefaults.roundTo ? `, rounded up to ₱${costDefaults.roundTo}` : ""}`}</small>
            </div>
          </div>

          <div className="modalactions">
            <button className="primary" disabled={!canSave}><Save size={14} /> Save Entry</button>
          </div>
        </form>
      </div>

      {tracksOpenPlayFee && (
        <OpenPlayFees attendees={attendees} fee={eventFee} maxPlayers={maxPlayers} onSetPaid={onSetAttendeePaid} />
      )}

      <div className="panel history-panel">
        <PanelHead title="Rental History" sub="Everyone's split, and who still owes." />
        {costs.filter((entry) => !isOpenPlay || !entry.bookingId).map((entry) => (
          <CostEntry
            key={entry.id} entry={entry} players={players}
            onTogglePaid={onTogglePaid} onToggleLive={onToggleLive} onDelete={onDelete}
          />
        ))}
        {!costs.some((entry) => !isOpenPlay || !entry.bookingId) && <div className="empty">No court rentals logged yet.</div>}
      </div>
    </>
  );
}
