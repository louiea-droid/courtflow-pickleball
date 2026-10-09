import { useState } from "react";
import { ArrowLeft, Banknote, Check, ChevronDown, CreditCard, Pencil, Play, Share2, Trash2, X } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import DateTile from "../components/DateTile";
import { bookingTotals, endHM, splitAttendees } from "../utils/bookings";
import { formatDay, formatHM, formatTime, money } from "../utils/format";
import { gameSummary } from "../utils/gameSession";

function PayControls({ a, request, onPaid, onMethod, onRef }) {
  const paid = a.paid === "paid";
  const refunded = a.paid === "refunded";
  const method = a.method === "online" ? "Online" : "Cash";
  return (
    <div className="pay-controls">
      <button
        type="button"
        className={`pay-control pay-status${paid ? " is-paid" : refunded ? " is-refunded" : " is-unpaid"}`}
        aria-label={paid ? "Mark unpaid" : refunded ? "Clear refund and mark unpaid" : "Mark paid"}
        title={paid ? "Mark unpaid" : refunded ? "Clear refund and mark unpaid" : "Mark paid"}
        onClick={() => onPaid(paid || refunded ? "unpaid" : "paid")}
      >
        {paid ? <Check size={14} aria-hidden="true" /> : null}
        {paid ? "Paid" : refunded ? "Refunded" : "Mark paid"}
      </button>
      <button
        type="button"
        className="pay-control pay-method"
        onClick={onMethod}
        aria-label={`Payment method: ${method}. Switch to ${method === "Cash" ? "Online" : "Cash"}.`}
        title={`Switch to ${method === "Cash" ? "Online" : "Cash"}`}
      >
        {method === "Cash" ? <Banknote size={14} aria-hidden="true" /> : <CreditCard size={14} aria-hidden="true" />}
        {method}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {a.paid === "paid" && <button className="tiny outline" onClick={() => onPaid("refunded")}>Refund</button>}
      {a.method === "online" && request && (
        <input
          className="ref-input" defaultValue={request.ref || ""} placeholder="Reference no." maxLength={60}
          aria-label="Payment reference" onBlur={(e) => e.target.value.trim() !== (request.ref || "") && onRef(e.target.value.trim())}
        />
      )}
    </div>
  );
}

function AttendeeRow({ a, request, note, eventId, actions }) {
  return (
    <div className="attendee-row">
      <div className="attendee-name">
        <b>{a.name}</b>
        <small>{[note, request?.contact].filter(Boolean).join(" · ")}</small>
      </div>
      <PayControls
        a={a}
        request={request}
        onPaid={(paid) => actions.setPaid(eventId, a.id, paid)}
        onMethod={() => actions.patch(eventId, a.id, { method: a.method === "online" ? "cash" : "online" })}
        onRef={(ref) => actions.setRef(eventId, request.id, ref)}
      />
      <button className="icon danger" onClick={() => actions.kick(eventId, a.id)} aria-label={`Remove ${a.name}`}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function EventPage({
  event, requests, actions, ready, gamePlayers, gameLoaded, onEdit, onShare, onPickPlayers, onOpenGame, onReopen, navigate, base,
}) {
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const back = (e) => { e.preventDefault(); navigate(`${base}/host`); };

  if (!event) {
    return ready ? (
      <div className="panel notice">
        <p>This open play doesn't exist or was deleted.</p>
        <a className="outline back-link" href={`${base}/host`} onClick={back}><ArrowLeft size={14} /> Back to open play</a>
      </div>
    ) : <div className="loading"><span className="spinner" />Loading…</div>;
  }

  const { confirmed, waitlist } = splitAttendees(event);
  const totals = bookingTotals(event);
  const pending = requests.filter((r) => r.status === "pending");
  const requestOf = (a) => requests.find((r) => r.seatId === a.id);
  const full = confirmed.length >= event.maxPlayers;
  const summary = gameSummary(gamePlayers, event.format);
  const gameLine = event.status === "live" ? (
    <p className="booking-money">
      <b>Game in progress</b>{gameLoaded ? ` · ${summary.checkedIn} checked in of ${summary.players}` : ""}
    </p>
  ) : event.status === "ended" ? (
    <p className="booking-money">
      <b>Game ended</b>{gameLoaded ? ` · ${summary.players} players, ${summary.matches} ${summary.matches === 1 ? "match" : "matches"}` : ""}{event.endedAt ? ` · ${formatTime(event.endedAt)}` : ""}
    </p>
  ) : null;

  return (
    <>
      <a className="back-link" href={`${base}/host`} onClick={back}><ArrowLeft size={14} /> Open play</a>
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

      <div className={`panel event-management${event.walkIn ? " event-management-walk-in" : ""}`}>
        {gameLine && <div className={`event-game-status is-${event.status}`}>{gameLine}</div>}
        <div className="event-management-grid">
          {!event.walkIn && (
            <section className="event-roster" aria-label="Event players and requests">
              {pending.length > 0 && (
                <div className="booking-block event-requests">
                  <h4>Join requests <span className="count-badge">{pending.length}</span></h4>
                  {pending.map((r) => (
                    <div className="attendee-row" key={r.id}>
                      <div className="attendee-name">
                        <b>{r.name}</b>
                        <small>{[r.contact, r.method === "online" ? `Online${r.ref ? ` · ref ${r.ref}` : ""}` : "Pays cash"].join(" · ")}</small>
                      </div>
                      <div className="pay-controls">
                        <button type="button" className="tiny accent" onClick={() => actions.approve(event.id, r)}>Approve</button>
                        <button type="button" className="tiny outline" onClick={() => actions.decline(event.id, r)}>Decline</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="booking-block">
                <div className="event-section-heading">
                  <h4>Players</h4>
                  <span className="count-badge">{confirmed.length}/{event.maxPlayers}</span>
                </div>
                <form className="booking-add" onSubmit={(e) => { e.preventDefault(); actions.add(event.id, name); setName(""); }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a player by name" aria-label="Add a player" maxLength={60} />
                  <button className="primary" disabled={!name.trim()}>{full ? "Add to waitlist" : "Add player"}</button>
                </form>
                {confirmed.map((a) => (
                  <AttendeeRow key={a.id} a={a} request={requestOf(a)} eventId={event.id} actions={actions} />
                ))}
                {!confirmed.length && (
                  <div className="event-empty">
                    <b>No players yet</b>
                    <span>Add someone above or share the booking page to fill the event.</span>
                  </div>
                )}
              </div>

              {waitlist.length > 0 && (
                <div className="booking-block">
                  <h4>Waitlist <span className="count-badge">{waitlist.length}</span></h4>
                  {waitlist.map((a, i) => (
                    <AttendeeRow key={a.id} a={a} request={requestOf(a)} note={`#${i + 1} in line`} eventId={event.id} actions={actions} />
                  ))}
                </div>
              )}
              {event.notes && <p className="booking-notes">{event.notes}</p>}
            </section>
          )}

          <aside className="event-tools" aria-label="Event controls">
            {!event.walkIn && event.fee > 0 && (
              <section className="event-fee-summary" aria-label="Booking fee summary">
                <h3>Booking fees</h3>
                <div>
                  <span>Collected</span>
                  <b>{money(totals.collected)}</b>
                </div>
                <div>
                  <span>Expected</span>
                  <b>{money(totals.expected)}</b>
                </div>
              </section>
            )}

            <section className="event-game-tools" aria-label="Game and event actions">
              {event.status === "ended" ? (
                <button type="button" className="primary event-main-action" onClick={onReopen}><Play size={15} /> Reopen game</button>
              ) : event.status === "live" ? (
                <>
                  <button type="button" className="primary event-main-action" onClick={onOpenGame}><Play size={15} /> Back to game</button>
                  {!event.walkIn && <button type="button" className="outline event-secondary-action" onClick={onPickPlayers}>Add players to game</button>}
                </>
              ) : (
                <button type="button" className="primary event-main-action" onClick={onPickPlayers}><Play size={15} /> Proceed to game</button>
              )}
              {!event.walkIn && (
                <>
                  <button type="button" className="outline event-secondary-action" onClick={() => onEdit(event)}><Pencil size={14} /> Edit event</button>
                  <button type="button" className="outline event-secondary-action" onClick={onShare}><Share2 size={14} /> Share booking page</button>
                </>
              )}
            </section>

            <button type="button" className="event-delete-action" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete event</button>
          </aside>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this open play?"
          message={`${event.title}, its player list, payment records, join requests and any game (players, matches and costs) will be removed. Players with a pending request will see it's no longer listed.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => { setConfirmDelete(false); await actions.remove(event.id); navigate(`${base}/host`); }}
        />
      )}
    </>
  );
}
