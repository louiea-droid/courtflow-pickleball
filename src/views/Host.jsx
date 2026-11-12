import { useState } from "react";
import { CalendarPlus, ChevronRight, Play } from "lucide-react";
import DateTile from "../components/DateTile";
import PageTitle from "../components/PageTitle";
import Wave from "../components/Wave";
import { useDocs } from "../hooks/useLiveDocs";
import { bookingTotals, byStart, endHM, isOver, splitAttendees } from "../utils/bookings";
import { formatHM, money } from "../utils/format";
import { liveChips } from "../utils/liveBoard";
import { dayHeading, groupByDate } from "../utils/sessions";

const PAST_PAGE = 10;
const pct = (n, d) => (d ? Math.round((Math.min(n, d) / d) * 100) : 0);
export const timeLine = (e) =>
  `${formatHM(e.startTime)} – ${formatHM(endHM(e))}${e.level && e.level !== "Any Level" ? ` · ${e.level}` : ""}${e.fee ? ` · ${money(e.fee)}` : e.walkIn ? "" : " · Free"}`;
const requestsChip = (n) => n > 0 && <span className="host-req">{n} new request{n === 1 ? "" : "s"}</span>;

export function Meter({ label, value, pctValue, tone }) {
  return (
    <div className="host-meter">
      <span><b>{label}</b><small>{value}</small></span>
      <span className="host-track" aria-hidden="true"><i className={tone} style={{ width: `${pctValue}%` }} /></span>
    </div>
  );
}

// An upcoming game: bookings and payments as two bars, a lime chip while join requests wait.
function EventCard({ e, pending, open }) {
  const { confirmed, waitlist } = splitAttendees(e);
  const t = bookingTotals(e);
  const full = e.maxPlayers && confirmed.length >= e.maxPlayers;
  return (
    <a className="host-card" href={open.href} onClick={open.onClick}>
      <DateTile date={e.date} />
      <span className="host-card-main">
        <b>{e.title}{requestsChip(pending)}</b>
        <small>{timeLine(e)}</small>
      </span>
      <span className="host-meters">
        {e.walkIn ? <span className="pill off">Walk-in</span> : (
          <Meter
            label={full ? `Full${waitlist.length ? ` · ${waitlist.length} waiting` : ""}` : `${confirmed.length} of ${e.maxPlayers} booked`}
            value={`${pct(confirmed.length, e.maxPlayers)}%`} pctValue={pct(confirmed.length, e.maxPlayers)}
          />
        )}
        {e.fee > 0 && t.seats > 0 && (
          <Meter label={`${t.paidCount} of ${t.seats} paid`} value={money(t.collected)} pctValue={pct(t.paidCount, t.seats)} tone="paid" />
        )}
      </span>
      <ChevronRight size={16} className="host-chev" aria-hidden="true" />
    </a>
  );
}

// A game in progress, on top: its court scores live and the way back into the game. Also on the Overview, where a
// member gets "View queue" (action) and no link to the event page (open = null).
export function LiveCard({ e, clubId, pending = 0, open, openGame, actionLabel = "Open game" }) {
  const courts = useDocs(["clubs", clubId, "events", e.id, "courts"]);
  const chips = liveChips(courts);
  return (
    <section className="host-live" aria-label={`Live now: ${e.title}`}>
      <DateTile date={e.date} />
      {(() => {
        const body = (
          <>
            <span className="host-live-tag"><i aria-hidden="true" /> Live now</span>
            <b>{e.title}{requestsChip(pending)}</b>
            <small>{timeLine(e)}</small>
          </>
        );
        return open ? <a className="host-live-main" href={open.href} onClick={open.onClick}>{body}</a> : <span className="host-live-main">{body}</span>;
      })()}
      {chips.length > 0 && (
        <span className="host-live-courts">
          {chips.map((c) => <span key={c.id}><small>{c.name}</small><b>{c.t1}–{c.t2}</b></span>)}
        </span>
      )}
      {openGame && <button className="home-btn lime" onClick={openGame}>{actionLabel} <ChevronRight size={16} /></button>}
    </section>
  );
}

// The club's Open play tab (managers): the actions, the game in progress, upcoming games by day, then past games.
export default function Host({ clubId, events, requestsByEvent, fallbackZone, today, navigate, base, onStartNew, onPlayNow }) {
  const [pastShown, setPastShown] = useState(PAST_PAGE);
  const current = events.filter((e) => !isOver(e, fallbackZone)).sort(byStart);
  const live = current.filter((e) => e.status === "live");
  const upcoming = current.filter((e) => e.status !== "live");
  const past = events.filter((e) => isOver(e, fallbackZone)).sort((a, b) => byStart(b, a));
  const pendingOf = (e) => (requestsByEvent[e.id] || []).filter((r) => r.status === "pending").length;
  const link = (to) => ({ href: to, onClick: (ev) => { ev.preventDefault(); navigate(to); } });
  const eventLink = (e) => link(`${base}/event/${e.id}`);
  const collected = past.reduce((n, e) => n + bookingTotals(e).collected, 0);
  const sub = upcoming.length ? `${upcoming.length} coming up` : live.length ? undefined : "Nothing coming up";

  const months = [];
  for (const e of past.slice(0, pastShown)) {
    const m = new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (months[months.length - 1]?.m !== m) months.push({ m, events: [] });
    months[months.length - 1].events.push(e);
  }

  return (
    <div className="host-page">
      <PageTitle title="Open play" sub={sub}>
        <button className="outline" onClick={onPlayNow}><Play size={15} /> Play now</button>
        <button className="host-new" onClick={onStartNew}><CalendarPlus size={15} /> Start new</button>
      </PageTitle>

      {live.map((e) => (
        <LiveCard key={e.id} e={e} clubId={clubId} pending={pendingOf(e)} open={eventLink(e)} openGame={() => navigate(`${base}/event/${e.id}/game`)} />
      ))}

      {groupByDate(upcoming).map((g) => (
        <section className="host-day" key={g.date}>
          <h2>{dayHeading(g.date, today)} <small>{g.events.length} game{g.events.length === 1 ? "" : "s"}</small></h2>
          {g.events.map((e) => <EventCard key={e.id} e={e} pending={pendingOf(e)} open={eventLink(e)} />)}
        </section>
      ))}

      {!current.length && (
        <section className="host-empty">
          <h2>No open play <span>yet.</span></h2>
          <p>Schedule a game and share the booking link: players reserve a seat and pay, and you run the queue on the night. Or start a game now for whoever showed up.</p>
          <div className="home-hero-actions">
            <button className="home-btn lime" onClick={onStartNew}><CalendarPlus size={16} /> Schedule open play</button>
            <button className="home-btn ghost" onClick={onPlayNow}><Play size={16} /> Play now</button>
          </div>
          <Wave />
        </section>
      )}

      {past.length > 0 && (
        <details className="host-past">
          <summary>
            Past open play
            <small>{past.length} game{past.length === 1 ? "" : "s"}{collected > 0 ? ` · ${money(collected)} collected` : ""}</small>
            <ChevronRight size={16} aria-hidden="true" />
          </summary>
          {months.map(({ m, events: list }) => (
            <div key={m}>
              <h3>{m}</h3>
              {list.map((e) => {
                const t = bookingTotals(e);
                const { href, onClick } = eventLink(e);
                return (
                  <a className="host-past-row" key={e.id} href={href} onClick={onClick}>
                    <span className="host-past-day">{new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    <b>{e.title}</b>
                    <small>{e.walkIn ? "Walk-in" : `${t.seats} booked`}</small>
                    <span className="host-past-money">{t.collected > 0 ? money(t.collected) : ""}</span>
                  </a>
                );
              })}
            </div>
          ))}
          {past.length > pastShown && (
            <button className="host-more" onClick={() => setPastShown((n) => n + PAST_PAGE)}>Show more</button>
          )}
        </details>
      )}
    </div>
  );
}
