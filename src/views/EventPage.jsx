import { useState } from "react";
import { ArrowLeft, Pencil, Play, Share2, Trash2, X } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import DateTile from "../components/DateTile";
import { bookingTotals, endHM, splitAttendees } from "../utils/bookings";
import { formatDay, formatHM, money } from "../utils/format";

function PayControls({ a, onPaid, onMethod, onRef }) {
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
      {a.paid === "paid" && <button className="tiny outline" onClick={() => onPaid("refunded")}>Refund</button>}
      {a.method === "online" && (
        <input
          className="ref-input" defaultValue={a.ref || ""} placeholder="Reference no." maxLength={60}
          aria-label="Payment reference" onBlur={(e) => e.target.value.trim() !== (a.ref || "") && onRef(e.target.value.trim())}
        />
      )}
    </div>
  );
}

function AttendeeRow({ a, contact, note, eventId, actions }) {
  return (
    <div className="attendee-row">
      <div className="attendee-name">
        <b>{a.name}</b>
        <small>{[note, contact].filter(Boolean).join(" · ")}</small>
      </div>
      <PayControls
        a={a}
        onPaid={(paid) => actions.setPaid(eventId, a.id, paid)}
        onMethod={() => actions.patch(eventId, a.id, { method: a.method === "online" ? "cash" : "online" })}
        onRef={(ref) => actions.patch(eventId, a.id, { ref })}
      />
      <button className="icon danger" onClick={() => actions.kick(eventId, a.id)} aria-label={`Remove ${a.name}`}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function EventPage({ event, requests, actions, ready, onEdit, onShare, navigate }) {
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const back = (e) => { e.preventDefault(); navigate("/host"); };

  if (!event) {
    return ready ? (
      <div className="panel">
        <div className="empty">This open play doesn't exist or was deleted.</div>
        <a className="outline back-link" href="/host" onClick={back}><ArrowLeft size={14} /> Back to open play</a>
      </div>
    ) : <div className="loading"><span className="spinner" />Loading…</div>;
  }

  const { confirmed, waitlist } = splitAttendees(event);
  const totals = bookingTotals(event);
  const pending = requests.filter((r) => r.status === "pending");
  const contactOf = (a) => requests.find((r) => r.id === a.id)?.contact;
  const full = confirmed.length >= event.maxPlayers;

  return (
    <>
      <a className="back-link" href="/host" onClick={back}><ArrowLeft size={14} /> Open play</a>
      <div className="event-head">
        <DateTile date={event.date} />
        <div>
          <h1>{event.title}</h1>
          <p>
            {formatDay(event.date)} · {formatHM(event.startTime)} – {formatHM(endHM(event))}
            {event.level && event.level !== "Any Level" ? ` · ${event.level}` : ""}
            {event.fee ? ` · ${money(event.fee)} per player` : " · Free"}
          </p>
        </div>
      </div>

      <div className="panel">
        {event.fee > 0 && (
          <p className="booking-money">
            <b>{money(totals.collected)}</b> collected of {money(totals.expected)} expected
          </p>
        )}

        {pending.length > 0 && (
          <div className="booking-block">
            <h4>Join requests <span className="count-badge">{pending.length}</span></h4>
            {pending.map((r) => (
              <div className="attendee-row" key={r.id}>
                <div className="attendee-name">
                  <b>{r.name}</b>
                  <small>{[r.contact, r.method === "online" ? `Online${r.ref ? ` · ref ${r.ref}` : ""}` : "Pays cash"].join(" · ")}</small>
                </div>
                <div className="pay-controls">
                  <button className="tiny accent" onClick={() => actions.approve(event.id, r)}>Approve</button>
                  <button className="tiny outline" onClick={() => actions.decline(event.id, r)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="booking-block">
          <h4>Players <span className="count-badge">{confirmed.length}/{event.maxPlayers}</span></h4>
          {confirmed.map((a) => (
            <AttendeeRow key={a.id} a={a} contact={contactOf(a)} eventId={event.id} actions={actions} />
          ))}
          {!confirmed.length && <div className="empty">Nobody has joined yet.</div>}
        </div>

        {waitlist.length > 0 && (
          <div className="booking-block">
            <h4>Waitlist <span className="count-badge">{waitlist.length}</span></h4>
            {waitlist.map((a, i) => (
              <AttendeeRow key={a.id} a={a} contact={contactOf(a)} note={`#${i + 1} in line`} eventId={event.id} actions={actions} />
            ))}
          </div>
        )}

        <form className="booking-add" onSubmit={(e) => { e.preventDefault(); actions.add(event.id, name); setName(""); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a player by name" aria-label="Add a player" maxLength={60} />
          <button className="primary" disabled={!name.trim()}>{full ? "Add to waitlist" : "Add"}</button>
        </form>
        {event.notes && <p className="booking-notes">{event.notes}</p>}

        <div className="cost-actions">
          <button className="pill toggle" disabled title="Coming in the next update"><Play size={12} /> Proceed to game (coming soon)</button>
          <button className="pill toggle off" onClick={() => onEdit(event)}><Pencil size={12} /> Edit</button>
          <button className="pill toggle off" onClick={onShare}><Share2 size={12} /> Share booking page</button>
          <button className="tiny danger" onClick={() => setConfirmDelete(true)}><Trash2 size={12} /> Delete</button>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this open play?"
          message={`${event.title}, its player list, payment records and join requests will be removed. Players with a pending request will see it's no longer listed.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => { setConfirmDelete(false); await actions.remove(event.id); navigate("/host"); }}
        />
      )}
    </>
  );
}
