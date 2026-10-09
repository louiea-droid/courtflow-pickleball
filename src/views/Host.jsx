import { ChevronRight } from "lucide-react";
import DateTile from "../components/DateTile";
import PanelHead from "../components/PanelHead";
import { bookingTotals, byStart, endHM, isOver, splitAttendees } from "../utils/bookings";
import { formatHM, money } from "../utils/format";
import PageTitle from "../components/PageTitle";

function EventRow({ e, pending, navigate, base }) {
  const { confirmed } = splitAttendees(e);
  const totals = bookingTotals(e);
  const to = `${base}/event/${e.id}`;
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

export default function Host({ events, requestsByEvent, fallbackZone, navigate, base }) {
  const upcoming = events.filter((e) => !isOver(e, fallbackZone)).sort(byStart);
  const past = events.filter((e) => isOver(e, fallbackZone)).sort((a, b) => byStart(b, a));
  const pendingOf = (e) => (requestsByEvent[e.id] || []).filter((r) => r.status === "pending").length;
  const row = (e) => <EventRow key={e.id} e={e} pending={pendingOf(e)} navigate={navigate} base={base} />;

  return (
    <>
      <PageTitle title="Open play" sub="Schedule a session, take bookings, and record who has paid." />
      <div className="panel">
        <PanelHead title="Upcoming" sub="Open an event to manage players, payments and join requests." />
        {upcoming.map(row)}
        {!upcoming.length && <div className="empty">No open play scheduled. Select Start new to schedule a session.</div>}
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
