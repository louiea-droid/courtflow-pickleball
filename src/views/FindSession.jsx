import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import PageTitle from "../components/PageTitle";
import SessionCard from "../components/SessionCard";
import { useToday } from "../hooks/useToday";
import { addDays, dayHeading, filterSessions, groupByDate, weekDays } from "../utils/sessions";
import { formatDay } from "../utils/format";

// Open play and bookings from public clubs, joined or not: pick a day, search by club, place or session name.
export default function FindSession({ clubs, sessions: { sessions, ready, error }, navigate }) {
  const today = useToday();
  const [date, setDate] = useState("any");
  const [text, setText] = useState("");
  const mine = new Set(clubs.map((c) => c.id));
  const [weekOffset, setWeekOffset] = useState(0); // 0 = the week starting today; past days have no sessions to show
  const week = weekDays(addDays(today, weekOffset * 7));
  const hasSessions = new Set(sessions.map((s) => s.date));
  const shown = filterSessions(sessions, text, date);

  return (
    <div className="page-narrow">
      <PageTitle title="Find session" sub="Open play and bookings from public clubs, joined or not." />
      <div className="week-strip" role="group" aria-label="Day">
        <button type="button" className="week-nav" aria-label="Previous week" disabled={weekOffset === 0} onClick={() => setWeekOffset((w) => w - 1)}><ChevronLeft size={16} /></button>
        <button type="button" className="week-all" aria-pressed={date === "any"} onClick={() => setDate("any")}>All</button>
        {week.map((d) => (
          <button
            key={d.date} type="button" className="week-day" aria-pressed={d.date === date}
            aria-label={`${dayHeading(d.date, today)}${hasSessions.has(d.date) ? ", has sessions" : ""}`}
            onClick={() => setDate(d.date === date ? "any" : d.date)}
          >
            <small>{d.wd}</small><b>{d.day}</b><i className={hasSessions.has(d.date) ? "on" : undefined} aria-hidden="true" />
          </button>
        ))}
        <button type="button" className="week-nav" aria-label="Next week" disabled={weekOffset >= 26} onClick={() => setWeekOffset((w) => w + 1)}><ChevronRight size={16} /></button>
      </div>
      <label className="find-search">
        <Search size={16} />
        <input
          type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Search by club, place or session" aria-label="Search sessions"
        />
      </label>

      {!ready ? (
        <p className="hub-empty">Loading sessions…</p>
      ) : error ? (
        <div className="panel notice"><p>Couldn't load sessions. Check your connection and try again.</p></div>
      ) : sessions.length === 0 ? (
        <div className="panel notice">
          <p>No open play is scheduled yet. Check back soon, or find a club to join.</p>
          <a className="outline" href="/clubs/find" onClick={(e) => { e.preventDefault(); navigate("/clubs/find"); }}>Find a club</a>
        </div>
      ) : shown.length === 0 ? (
        <p className="hub-empty">{date !== "any" && !text.trim() ? `No sessions on ${formatDay(date)}. Try another day, or All.` : "No sessions match. Try another day or All."}</p>
      ) : groupByDate(shown).map((g) => (
        <section className="session-group" key={g.date}>
          <h2 className="club-section">{dayHeading(g.date, today)}</h2>
          <div className="find-list">
            {g.events.map((s) => <SessionCard key={`${s.clubId}/${s.id}`} session={s} mine={mine.has(s.clubId)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
