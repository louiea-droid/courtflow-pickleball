import { CalendarPlus, ChevronRight, Play, Share2 } from "lucide-react";
import DateTile from "../components/DateTile";
import PanelHead from "../components/PanelHead";
import { bookingTotals, byStart, endHM, isOver, splitAttendees } from "../utils/bookings";
import { formatHM, money } from "../utils/format";

function EventRow({ e, pending, navigate }) {
  const { confirmed } = splitAttendees(e);
  const totals = bookingTotals(e);
  const to = `/event/${e.id}`;
  return (
    <a className="booking-head event-row" href={to} onClick={(ev) => { ev.preventDefault(); navigate(to); }}>
      <DateTile date={e.date} />
      <div className="booking-main">
        <b>{e.title}</b>
        <small>
          {formatHM(e.startTime)} – {formatHM(endHM(e))}
          {e.level && e.level !== "Any Level" ? ` · ${e.level}` : ""}
          {e.fee ? ` · ${money(e.fee)}` : " · Free"}
        </small>
      </div>
      <div className="history-entry-badges">
        {pending > 0 && <span className="badge-open">{pending} new</span>}
        {e.status === "live" && <span className="badge-open">Live</span>}
        {e.walkIn ? (
          <span className="pill off">Walk-in</span>
        ) : (
          <>
            <span className={`pill ${confirmed.length >= e.maxPlayers ? "" : "off"}`}>{confirmed.length}/{e.maxPlayers} joined</span>
            {e.fee > 0 && (
              <span className={`pill settle-badge ${totals.seats && totals.paidCount === totals.seats ? "" : "off"}`}>
                {totals.paidCount}/{totals.seats} paid
              </span>
            )}
          </>
        )}
      </div>
      <ChevronRight size={15} />
    </a>
  );
}

export default function Host({ events, requestsByEvent, fallbackZone, onNew, onPlayNow, onShare, navigate }) {
  const upcoming = events.filter((e) => !isOver(e, fallbackZone)).sort(byStart);
  const past = events.filter((e) => isOver(e, fallbackZone)).sort((a, b) => byStart(b, a));
  const pendingOf = (e) => (requestsByEvent[e.id] || []).filter((r) => r.status === "pending").length;
  const row = (e) => <EventRow key={e.id} e={e} pending={pendingOf(e)} navigate={navigate} />;

  return (
    <>
      <h1>Host open play</h1>
      <p>Schedule a session, take bookings, and record who has paid.</p>
      <div className="panel">
        <PanelHead title="Upcoming" sub="Open an event to manage players, payments and join requests." />
        <div className="booking-toolbar">
          <button className="outline" onClick={onPlayNow}><Play size={15} /> Play now</button>
          <button className="primary" onClick={onNew}><CalendarPlus size={15} /> New open play</button>
          <button className="outline" onClick={onShare}><Share2 size={15} /> Share booking page</button>
        </div>
        {upcoming.map(row)}
        {!upcoming.length && <div className="empty">No open play scheduled. Create one to start taking bookings.</div>}
      </div>
      {past.length > 0 && (
        <details className="panel history-panel booking-past">
          <summary>Past open play <span className="count-badge">{past.length}</span></summary>
          {past.map(row)}
        </details>
      )}
    </>
  );
}
