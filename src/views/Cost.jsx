import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, ChevronDown, Download, MonitorPlay, Save, Trash2 } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import { FeeFilters, FeeProgress, MethodSwitch, StatusPill } from "../components/PaymentParts";
import PanelHead from "../components/PanelHead";
import PersonBadge from "../components/PersonBadge";
import { feeCsv, feeReport, feeRows, feeTotals } from "../utils/gameSession";
import { downloadCsv } from "../utils/download";
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

const FILTERS = [["unpaid", "Unpaid"], ["paid", "Paid"], ["waitlist", "Waitlist"], ["refunded", "Refunded"], ["all", "All"]];
const isOpen = (r) => r.paid !== "paid" && r.paid !== "refunded";
const FILTER_TESTS = {
  unpaid: (r) => !r.waiting && isOpen(r),
  paid: (r) => r.paid === "paid",
  waitlist: (r) => r.waiting && isOpen(r),
  refunded: (r) => r.paid === "refunded",
  all: () => true,
};
const RANK = ["unpaid", "paid", "waitlist", "refunded"];
const rankOf = (r) => RANK.findIndex((key) => FILTER_TESTS[key](r));

function FeeRow({ row, fee, onSetPaid, onSetMethod }) {
  const paid = row.paid === "paid";
  const refunded = row.paid === "refunded";
  return (
    <div className="fee-row">
      <div className="fee-who">
        <b>{row.name}</b>
        <small>{row.waiting ? "Waitlist · not yet due" : money(fee)}</small>
      </div>
      <MethodSwitch name={row.name} method={row.method} onChange={(m) => onSetMethod(row, m)} />
      <StatusPill name={row.name} status={paid ? "paid" : refunded ? "refunded" : "unpaid"} onClick={() => onSetPaid([row], paid || refunded ? "unpaid" : "paid")} />
    </div>
  );
}

// A Play now game has no set fee, so the host types one here. Saved on blur or Enter.
function FeeInput({ fee, onSave }) {
  const [value, setValue] = useState(fee ? String(fee) : "");
  const save = () => {
    const n = Math.max(0, parseFloat(value) || 0);
    setValue(n ? String(n) : "");
    if (n !== fee) onSave(n);
  };
  return (
    <label className="open-play-fee-input">
      Fee per player (₱)
      <input
        type="number" min="0" step="0.01" placeholder="0.00" value={value}
        onChange={(e) => setValue(e.target.value)} onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    </label>
  );
}

// Rows are the booked attendees (paid lives on the event) plus everyone added in the game who
// isn't one (paid lives on the player), so nobody in the game is left out of the fees.
function OpenPlayFees({ event, players, fee, canSetFee, onSetFee, onSetAttendeesPaid, onSetPlayersPaid, onSetAttendeeMethod, onSetPlayerMethod }) {
  const rows = feeRows(event, players);
  const { total, collected, remaining, unpaid, paid } = feeTotals(rows, fee);
  const [picked, setPicked] = useState(null);
  const [search, setSearch] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const filter = picked ?? (unpaid ? "unpaid" : "all"); // opens on the job to do, until the host picks a view
  const counts = Object.fromEntries(FILTERS.map(([key]) => [key, rows.filter(FILTER_TESTS[key]).length]));
  const q = search.trim().toLowerCase();
  const visible = rows
    .filter((r) => FILTER_TESTS[filter](r) && (!q || r.name.toLowerCase().includes(q)))
    .sort((a, b) => (filter === "all" ? rankOf(a) - rankOf(b) : 0));
  const pct = total ? Math.round((collected / total) * 100) : 0;

  const setPaid = (list, value) => {
    const booked = list.filter((r) => r.attendee).map((r) => r.id);
    const walkIns = list.filter((r) => !r.attendee).map((r) => r.id);
    if (booked.length) onSetAttendeesPaid(booked, value);
    if (walkIns.length) onSetPlayersPaid(walkIns, value === "paid");
  };
  const setMethod = (row, value) => (row.attendee ? onSetAttendeeMethod(row.id, value) : onSetPlayerMethod(row.id, value));
  const owing = rows.filter(FILTER_TESTS.unpaid);
  const emptyText = q ? `No players match “${search.trim()}”.`
    : filter === "unpaid" ? (rows.length ? "Everyone has paid." : "Add players to this game to track their fees.")
    : "No players here.";

  return (
    <div className="panel open-play-fees">
      <div className="fee-head">
        <PanelHead title="Open Play fees" sub={fee > 0 ? `${money(fee)} per player.` : "No fee set yet."} />
        {fee > 0 && rows.length > 0 && (
          <button type="button" className="outline fee-export" onClick={() => exportFees(event, players, fee)}>
            <Download size={14} /> Export to Excel
          </button>
        )}
      </div>
      {canSetFee && <FeeInput fee={fee} onSave={onSetFee} />}

      {total > 0 && <FeeProgress collected={collected} total={total} remaining={remaining} paidCount={paid} ofCount={paid + unpaid} />}

      {rows.length > 0 && (
        <FeeFilters
          filters={FILTERS.filter(([key]) => key === "unpaid" || key === "all" || counts[key] > 0).map(([key, label]) => [key, label, counts[key]])}
          value={filter} onChange={setPicked} search={search} onSearch={setSearch}
        />
      )}

      {fee > 0 && owing.length > 0 && (
        <div className="fee-bulk">
          <button type="button" className="outline" onClick={() => setConfirmAll(true)}>
            <CheckCheck size={14} /> Mark all as paid ({owing.length})
          </button>
        </div>
      )}

      <div className="fee-list">
        {visible.map((r) => <FeeRow key={r.id} row={r} fee={fee} onSetPaid={setPaid} onSetMethod={setMethod} />)}
        {!visible.length && <div className="empty">{emptyText}</div>}
      </div>

      {confirmAll && (
        <ConfirmDialog
          title="Mark everyone as paid?"
          message={`${owing.length} ${owing.length === 1 ? "player" : "players"} owing ${money(owing.length * fee)} will be marked paid. Waitlisted players aren't included.`}
          confirmLabel="Mark all paid" confirmClass="primary"
          onCancel={() => setConfirmAll(false)}
          onConfirm={() => { setConfirmAll(false); setPaid(owing, "paid"); }}
        />
      )}
    </div>
  );
}

function exportFees(event, players, fee) {
  const report = feeReport({ ...event, fee }, players, 0);
  if (report) downloadCsv(`${report.title} fees.csv`, feeCsv(report));
}

export default function Cost({
  players, costs, costDefaults, onAdd, onTogglePaid, onToggleLive, onDelete,
  isOpenPlay, attendees = [], eventFee = 0, maxPlayers, canSetFee, onSetFee, onSetAttendeesPaid, onSetPlayersPaid, onSetAttendeeMethod, onSetPlayerMethod, eventTitle, eventDate,
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
  const tracksOpenPlayFee = isOpenPlay && (eventFee > 0 || canSetFee);
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

  const form = (
    <form className="rental-form" onSubmit={submit}>
      <label>
        Court / label
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Court 1" />
      </label>

      <div className="cost-calc-grid">
        <label>
          Rate per hour
          <input className="peso" type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" />
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
        <label>Splitting between <em>{selected.length} of {selectablePlayers.length}</em></label>
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
            aria-pressed={selected.includes(p.id)}
            className={`player-chip ${selected.includes(p.id) ? "selected" : ""}`}
            onClick={() => toggleSelected(p.id)}
          >
            <PersonBadge name={p.name} />
            {selected.includes(p.id) && <Check size={14} />}
          </button>
        ))}
        {!selectablePlayers.length && <span className="section-hint">Add players first, then come back here.</span>}
      </div>

      <div className="rental-total">
        <div className="rental-math">
          <span>Total <b>{money(total)}</b></span>
          <span className="rental-each">Each <b>{money(perPerson)}</b></span>
          <small>{`${selected.length || 0} splitting${!isOpenPlay && costDefaults.roundTo ? `, rounded up to ₱${costDefaults.roundTo}` : ""}`}</small>
        </div>
        <button className="primary" disabled={!canSave}><Save size={14} /> Save Entry</button>
      </div>
    </form>
  );
  const historyEntries = costs.filter((entry) => !isOpenPlay || !entry.bookingId);

  return (
    <>
      {tracksOpenPlayFee && (
        <OpenPlayFees
          event={{ attendees, maxPlayers, title: eventTitle, date: eventDate }} players={players} fee={eventFee} canSetFee={canSetFee}
          onSetFee={onSetFee} onSetAttendeesPaid={onSetAttendeesPaid} onSetPlayersPaid={onSetPlayersPaid}
          onSetAttendeeMethod={onSetAttendeeMethod} onSetPlayerMethod={onSetPlayerMethod}
        />
      )}

      {isOpenPlay ? (
        <details className="panel rental-fold">
          <summary>Split a court rental<span>Share a court booking between players</span></summary>
          {form}
        </details>
      ) : (
        <div className="panel cost-form">
          <PanelHead title="Split a court rental" sub="Share a court booking between players" />
          {form}
        </div>
      )}

      {(!isOpenPlay || historyEntries.length > 0) && (
        <div className="panel history-panel">
          <PanelHead title="Rental History" sub="Everyone's split, and who still owes." />
          {historyEntries.map((entry) => (
            <CostEntry
              key={entry.id} entry={entry} players={players}
              onTogglePaid={onTogglePaid} onToggleLive={onToggleLive} onDelete={onDelete}
            />
          ))}
          {!historyEntries.length && <div className="empty">No court rentals logged yet.</div>}
        </div>
      )}
    </>
  );
}
