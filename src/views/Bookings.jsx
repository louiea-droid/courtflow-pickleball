import { useState } from "react";
import { CalendarPlus, ChevronDown, ListChecks, Pencil, Share2, Trash2, X } from "lucide-react";
import PanelHead from "../components/PanelHead";
import ConfirmDialog from "../components/ConfirmDialog";
import { bookingTotals, byStart, endHM, hasEnded, splitAttendees } from "../utils/bookings";
import { formatDay, formatHM, money } from "../utils/format";

function DateTile({ date }) {
  const [wd, rest] = formatDay(date).split(", ");
  const [mon, day] = rest.split(" ");
  return (
    <span className="date-tile" aria-hidden="true">
      <small>{wd}</small><b>{day}</b><small>{mon}</small>
    </span>
  );
}

function PayControls({ a, onPaid, onMethod, onRef }) {
  const refundable = a.paid === "paid";
  return (
    <div className="pay-controls">
      <button
        className={`pill toggle ${a.paid === "paid" ? "" : "off"}`}
        onClick={() => onPaid(a.paid === "paid" || a.paid === "refunded" ? "unpaid" : "paid")}
      >
        {a.paid === "paid" ? "● Paid" : a.paid === "refunded" ? "Refunded" : "○ Unpaid"}
      </button>
      <button className="pill toggle off" onClick={onMethod} title="Switch cash / online">
        {a.method === "online" ? "Online" : "Cash"}
      </button>
      {refundable && <button className="tiny outline" onClick={() => onPaid("refunded")}>Refund</button>}
      {a.method === "online" && (
        <input
          className="ref-input" defaultValue={a.ref || ""} placeholder="Reference no." maxLength={60}
          aria-label="Payment reference" onBlur={(e) => e.target.value.trim() !== (a.ref || "") && onRef(e.target.value.trim())}
        />
      )}
    </div>
  );
}

function AttendeeRow({ a, contact, note, bookingId, actions }) {
  return (
    <div className="attendee-row">
      <div className="attendee-name">
        <b>{a.name}</b>
        <small>{[note, contact].filter(Boolean).join(" · ")}</small>
      </div>
      <PayControls
        a={a}
        onPaid={(paid) => actions.setPaid(bookingId, a.id, paid)}
        onMethod={() => actions.patch(bookingId, a.id, { method: a.method === "online" ? "cash" : "online" })}
        onRef={(ref) => actions.patch(bookingId, a.id, { ref })}
      />
      <button className="icon danger" onClick={() => actions.kick(bookingId, a.id)} aria-label={`Remove ${a.name}`}>
        <X size={14} />
      </button>
    </div>
  );
}

function BookingCard({ b, requests, players, past, actions, onEdit }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { confirmed, waitlist } = splitAttendees(b);
  const totals = bookingTotals(b);
  const pending = requests.filter((r) => r.bookingId === b.id && r.status === "pending");
  const contactOf = (a) => requests.find((r) => r.id === a.id)?.contact;
  const onList = new Set((b.attendees || []).map((a) => a.name.trim().toLowerCase()));
  const suggestions = players.filter((p) => !onList.has(p.name.trim().toLowerCase()));
  const full = confirmed.length >= b.maxPlayers;

  return (
    <div className={`booking ${past ? "past" : ""}`}>
      <button className="booking-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <DateTile date={b.date} />
        <div className="booking-main">
          <b>{b.title}</b>
          <small>
            {formatHM(b.startTime)} – {formatHM(endHM(b))}
            {b.level && b.level !== "Any Level" ? ` · ${b.level}` : ""}
            {b.fee ? ` · ${money(b.fee)}` : " · Free"}
          </small>
        </div>
        <div className="history-entry-badges">
          {pending.length > 0 && <span className="badge-open">{pending.length} new</span>}
          <span className={`pill ${full ? "" : "off"}`}>{confirmed.length}/{b.maxPlayers} joined</span>
          {b.fee > 0 && (
            <span className={`pill settle-badge ${totals.paidCount === totals.seats && totals.seats ? "" : "off"}`}>
              {totals.paidCount}/{totals.seats} paid
            </span>
          )}
        </div>
        <ChevronDown size={15} className={open ? "rot" : ""} />
      </button>

      {open && (
        <div className="booking-body">
          {b.fee > 0 && (
            <p className="booking-money">
              <b>{money(totals.collected)}</b> collected of {money(totals.expected)} expected
            </p>
          )}

          {pending.length > 0 && (
            <div className="booking-block">
              <h4>Join requests</h4>
              {pending.map((r) => (
                <div className="attendee-row" key={r.id}>
                  <div className="attendee-name">
                    <b>{r.name}</b>
                    <small>{[r.contact, r.method === "online" ? `Online${r.ref ? ` · ref ${r.ref}` : ""}` : "Pays cash"].join(" · ")}</small>
                  </div>
                  <div className="pay-controls">
                    <button className="tiny accent" onClick={() => actions.approve(r)}>Approve</button>
                    <button className="tiny outline" onClick={() => actions.decline(r)}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="booking-block">
            <h4>Players <span className="count-badge">{confirmed.length}</span></h4>
            {confirmed.map((a) => (
              <AttendeeRow key={a.id} a={a} contact={contactOf(a)} bookingId={b.id} actions={actions} />
            ))}
            {!confirmed.length && <div className="empty">Nobody has joined yet.</div>}
          </div>

          {waitlist.length > 0 && (
            <div className="booking-block">
              <h4>Waitlist <span className="count-badge">{waitlist.length}</span></h4>
              {waitlist.map((a, i) => (
                <AttendeeRow key={a.id} a={a} contact={contactOf(a)} note={`#${i + 1} in line`} bookingId={b.id} actions={actions} />
              ))}
            </div>
          )}

          <form
            className="booking-add"
            onSubmit={(e) => { e.preventDefault(); actions.add(b.id, name); setName(""); }}
          >
            <input
              list={`roster-${b.id}`} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Add a player: pick from the roster or type a name" aria-label="Add a player"
            />
            <datalist id={`roster-${b.id}`}>{suggestions.map((p) => <option key={p.id} value={p.name} />)}</datalist>
            <button className="primary" disabled={!name.trim()}>{full ? "Add to waitlist" : "Add"}</button>
          </form>
          {b.notes && <p className="booking-notes">{b.notes}</p>}

          <div className="cost-actions">
            <button className="pill toggle" onClick={() => actions.start(b.id)} disabled={!confirmed.length}>
              <ListChecks size={12} /> {b.startedAt ? "Check in again" : `Check in ${confirmed.length} to the queue`}
            </button>
            <button className="pill toggle off" onClick={() => onEdit(b)}><Pencil size={12} /> Edit</button>
            <button className="tiny danger" onClick={() => setConfirmDelete(true)}><Trash2 size={12} /> Delete</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this open play?"
          message={`${b.title} and its player list and payment records will be removed. Players with a pending request will see it's no longer listed.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { setConfirmDelete(false); actions.remove(b.id); }}
        />
      )}
    </div>
  );
}

export default function Bookings({ bookings, requests, players, now, actions, onNew, onEdit, onShare }) {
  const upcoming = bookings.filter((b) => !hasEnded(b, now)).sort(byStart);
  const past = bookings.filter((b) => hasEnded(b, now)).sort((a, b) => byStart(b, a));
  const card = (b, isPast) => (
    <BookingCard key={b.id} b={b} requests={requests} players={players} past={isPast} actions={actions} onEdit={onEdit} />
  );

  return (
    <>
      <div className="panel">
        <PanelHead title="Upcoming open play" sub="Schedule a session, take bookings, and record who has paid." />
        <div className="booking-toolbar">
          <button className="primary" onClick={onNew}><CalendarPlus size={15} /> New open play</button>
          <button className="outline" onClick={onShare}><Share2 size={15} /> Share booking page</button>
        </div>
        {upcoming.map((b) => card(b, false))}
        {!upcoming.length && <div className="empty">No open play scheduled. Create one to start taking bookings.</div>}
      </div>

      {past.length > 0 && (
        <details className="panel history-panel booking-past">
          <summary>Past open play <span className="count-badge">{past.length}</span></summary>
          {past.map((b) => card(b, true))}
        </details>
      )}
    </>
  );
}
