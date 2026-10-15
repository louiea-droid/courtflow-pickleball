import { useState } from "react";
import { ArrowLeft, CheckCheck, Download, LayoutGrid, Pencil, Play, Share2, Trash2 } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import Modal from "../components/Modal";
import CourtSettingsModal from "../components/CourtSettingsModal";
import DateTile from "../components/DateTile";
import { FeeFilters, FeeProgress, MethodSwitch, StatusPill } from "../components/PaymentParts";
import RowMenu from "../components/RowMenu";
import { endHM, filterAttendees, owingIds, splitAttendees } from "../utils/bookings";
import { formatDay, formatHM, formatTime, money } from "../utils/format";
import { feeCsv, feeReport, feeTotals, gameSummary } from "../utils/gameSession";
import { downloadCsv } from "../utils/download";

// One player: the same status pill and Cash / GCash switch as the game's Payment page; refund and remove live behind "⋯".
function AttendeeRow({ a, request, note, eventId, actions, onRemove, onReceipt }) {
  const paid = a.paid === "paid";
  const refunded = a.paid === "refunded";
  const sub = [note, request?.contact].filter(Boolean).join(" · ");
  return (
    <div className="fee-row event-fee-row">
      <div className="fee-who">
        <b>{a.name}</b>
        {sub && <small>{sub}</small>}
      </div>
      <MethodSwitch name={a.name} method={a.method} onChange={(method) => actions.patch(eventId, a.id, { method })} />
      <StatusPill name={a.name} status={paid ? "paid" : refunded ? "refunded" : "unpaid"} onClick={() => actions.setPaid(eventId, a.id, paid || refunded ? "unpaid" : "paid")} />
      <RowMenu
        label={`More for ${a.name}`}
        items={[
          ...(request?.receipt ? [{ label: "View receipt", onSelect: () => onReceipt(a.name, request.receipt) }] : []),
          ...(paid ? [{ label: "Refund", onSelect: () => actions.setPaid(eventId, a.id, "refunded") }] : []),
          { label: "Remove from event", danger: true, onSelect: () => onRemove(a) },
        ]}
      />
      {a.method === "online" && request && (
        <input
          className="ref-input" defaultValue={request.ref || ""} placeholder="Reference no." maxLength={60}
          aria-label="Payment reference" onBlur={(e) => e.target.value.trim() !== (request.ref || "") && actions.setRef(eventId, request.id, e.target.value.trim())}
        />
      )}
    </div>
  );
}

export default function EventPage({
  event, requests, actions, ready, gamePlayers, gameLoaded, feeRecord, onEdit, onShare, onPickPlayers, onOpenGame, onReopen, onSaveCourts, courtDefaults, clubDisplay, onSetDisplay, navigate, base,
}) {
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [courtSettings, setCourtSettings] = useState(false);
  const [viewing, setViewing] = useState(null); // a payment receipt on screen: { name, src }
  const showReceipt = (name, src) => setViewing({ name, src });
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
  const pending = requests.filter((r) => r.status === "pending");
  const requestOf = (a) => requests.find((r) => r.seatId === a.id);
  const full = confirmed.length >= event.maxPlayers;
  const summary = gameSummary(gamePlayers, event.format);
  const everyone = event.attendees || [];
  const owing = owingIds(event);
  // The same sums as the game's Payment page (feeTotals): a paid waitlist player counts as collected and as owing.
  const confirmedIds = new Set(confirmed.map((a) => a.id));
  const sums = feeTotals(everyone.map((a) => ({ paid: a.paid, waiting: !confirmedIds.has(a.id) })), event.fee || 0);
  const countOf = (key) => filterAttendees(everyone, key).length;
  const shownConfirmed = filterAttendees(confirmed, filter, search);
  const shownWaitlist = filterAttendees(waitlist, filter, search);
  // Saved when the game ended; a game ended before this existed (or offline) falls back to the live data.
  const fees = event.status === "ended" ? feeRecord || (gameLoaded ? feeReport(event, gamePlayers, 0) : null) : null;
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
        {fees && (
          <div className="fee-record">
            <div className="fee-record-sums">
              <span>Total <b>{money(fees.total)}</b></span>
              <span>Collected <b>{money(fees.collected)}</b></span>
              <span>Remaining balance <b>{money(fees.remaining)}</b></span>
              <span>{fees.rows.filter((r) => r.status === "paid").length} of {fees.rows.filter((r) => r.status === "paid" || r.status === "unpaid").length} paid</span>
            </div>
            <button type="button" className="outline" onClick={() => downloadCsv(`${fees.title} fees.csv`, feeCsv(fees))}>
              <Download size={14} /> Export to Excel
            </button>
          </div>
        )}
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
                        <small>{[r.contact, r.method === "online" ? `Pays online${r.ref ? ` · ref ${r.ref}` : ""}${r.receipt ? "" : " · no receipt"}` : "Pays cash"].filter(Boolean).join(" · ")}</small>
                      </div>
                      <div className="pay-controls">
                        {r.receipt && (
                          <button type="button" className="receipt-thumb" aria-label={`View ${r.name}'s receipt`} onClick={() => showReceipt(r.name, r.receipt)}>
                            <img src={r.receipt} alt="" />
                          </button>
                        )}
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
                {everyone.length > 0 && (
                  <FeeFilters
                    filters={event.fee > 0 ? [["all", "All", everyone.length], ["unpaid", "Unpaid", countOf("unpaid")], ["paid", "Paid", countOf("paid")], ...(countOf("refunded") ? [["refunded", "Refunded", countOf("refunded")]] : [])] : []}
                    value={filter} onChange={setFilter} search={search} onSearch={setSearch}
                  />
                )}
                {event.fee > 0 && owing.length > 0 && (
                  <div className="fee-bulk">
                    <button type="button" className="outline" onClick={() => setConfirmAll(true)}>
                      <CheckCheck size={14} /> Mark all as paid ({owing.length})
                    </button>
                  </div>
                )}
                {shownConfirmed.map((a) => (
                  <AttendeeRow key={a.id} a={a} request={requestOf(a)} eventId={event.id} actions={actions} onRemove={setRemoving} onReceipt={showReceipt} />
                ))}
                {confirmed.length > 0 && !shownConfirmed.length && <div className="event-empty"><span>No players match.</span></div>}
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
                  {shownWaitlist.map((a) => (
                    <AttendeeRow key={a.id} a={a} request={requestOf(a)} note={`#${waitlist.indexOf(a) + 1} in line`} eventId={event.id} actions={actions} onRemove={setRemoving} onReceipt={showReceipt} />
                  ))}
                </div>
              )}
              {event.notes && <p className="booking-notes">{event.notes}</p>}
            </section>
          )}

          <aside className="event-tools" aria-label="Event controls">
            {!event.walkIn && event.fee > 0 && (
              <section className="event-fee-progress" aria-label="Booking fee summary">
                <FeeProgress
                  collected={sums.collected} total={sums.total} remaining={sums.remaining}
                  paidCount={sums.paid} ofCount={sums.paid + sums.unpaid}
                />
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
              {event.status !== "ended" && (
                <button type="button" className="outline event-secondary-action" onClick={() => setCourtSettings(true)}><LayoutGrid size={14} /> Court settings</button>
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

      {courtSettings && <CourtSettingsModal event={event} defaults={courtDefaults} display={clubDisplay} onSave={onSaveCourts} onSetDisplay={onSetDisplay} close={() => setCourtSettings(false)} />}
      {viewing && (
        <Modal title="Payment receipt" label={viewing.name} close={() => setViewing(null)} className="receipt-modal">
          <img className="receipt-full" src={viewing.src} alt={`${viewing.name}'s payment receipt`} />
        </Modal>
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          message={`They come off the list${removing.paid === "paid" ? " and their payment record goes with them" : ""}. If someone is waiting, the next in line moves up. This can't be undone.`}
          confirmLabel="Remove"
          onCancel={() => setRemoving(null)}
          onConfirm={() => { actions.kick(event.id, removing.id); setRemoving(null); }}
        />
      )}
      {confirmAll && (
        <ConfirmDialog
          title="Mark everyone as paid?"
          message={`${owing.length} ${owing.length === 1 ? "player" : "players"} owing ${money(owing.length * (event.fee || 0))} will be marked paid. Waitlisted players aren't included.`}
          confirmLabel="Mark all paid" confirmClass="primary"
          onCancel={() => setConfirmAll(false)}
          onConfirm={() => { setConfirmAll(false); actions.setPaidMany(event.id, owing, "paid"); }}
        />
      )}
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
