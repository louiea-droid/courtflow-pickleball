import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import PageTitle from "../components/PageTitle";
import SessionCard from "../components/SessionCard";
import { useToday } from "../hooks/useToday";
import { addDays, dayHeading, filterSessions, groupByDate, weekDays } from "../utils/sessions";
import { formatDay } from "../utils/format";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Open play from public clubs, joined or not. Search, the day strip and the quick filters share one bar that stays at the
// top while the list scrolls.
export default function FindSession({ clubs, sessions: { sessions, ready, error }, navigate }) {
  const today = useToday();
  const [date, setDate] = useState("any");
  const [text, setText] = useState("");
  const [level, setLevel] = useState(null);
  const [hasSpots, setHasSpots] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const mine = new Set(clubs.map((c) => c.id));
  const [weekOffset, setWeekOffset] = useState(0); // 0 = the week starting today; past days have no sessions to show
  const week = weekDays(addDays(today, weekOffset * 7));
  const hasSessions = new Set(sessions.map((s) => s.date));
  // Level chips: only the levels some session actually has.
  const levels = [...new Set(sessions.map((s) => s.level).filter((l) => l && l !== "Any Level"))].sort();
  const shown = filterSessions(sessions, text, date, { level, hasSpots, clubs: onlyMine ? mine : null });
  const filtered = level || hasSpots || onlyMine;

  return (
    <div className="page-narrow">
      <PageTitle title="Find a game" sub="Open play from public clubs, joined or not." />
      <div className="find-bar">
        <label className="find-search">
          <Search size={16} />
          <input
            type="search" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Search by club, place or session" aria-label="Search sessions"
          />
        </label>
        <div className="week-strip" role="group" aria-label="Day">
          <button type="button" className="week-nav" aria-label="Previous week" disabled={weekOffset === 0} onClick={() => setWeekOffset((w) => w - 1)}><ChevronLeft size={16} /></button>
          <button type="button" className="week-all" aria-pressed={date === "any"} onClick={() => setDate("any")}>All</button>
          {week.map((d) => (
            <button
              key={d.date} type="button" className="week-day" aria-pressed={d.date === date}
              aria-label={`${dayHeading(d.date, today)}${hasSessions.has(d.date) ? ", has sessions" : ""}`}
              onClick={() => setDate(d.date === date ? "any" : d.date)}
            >
              <small>{d.date === today ? "Today" : d.wd}</small><b>{d.day}</b><i className={hasSessions.has(d.date) ? "on" : undefined} aria-hidden="true" />
            </button>
          ))}
          <button type="button" className="week-nav" aria-label="Next week" disabled={weekOffset >= 26} onClick={() => setWeekOffset((w) => w + 1)}><ChevronRight size={16} /></button>
        </div>
        <div className="find-chips" role="group" aria-label="Filters">
          <button type="button" aria-pressed={!level} onClick={() => setLevel(null)}>Any level</button>
          {levels.map((l) => <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(level === l ? null : l)}>{l}</button>)}
          <button type="button" aria-pressed={hasSpots} onClick={() => setHasSpots(!hasSpots)}>Has spots</button>
          {mine.size > 0 && <button type="button" aria-pressed={onlyMine} onClick={() => setOnlyMine(!onlyMine)}>My clubs</button>}
        </div>
      </div>

      {!ready ? (
        <p className="hub-empty">Loading sessions…</p>
      ) : error ? (
        <div className="panel notice"><p>Couldn't load sessions. Check your connection and try again.</p></div>
      ) : sessions.length === 0 ? (
        <div className="panel notice">
          <p>No open play is scheduled yet. Check back soon, or find a club to join.</p>
          <a className="outline" href="/clubs/find" onClick={(e) => { e.preventDefault(); navigate("/clubs/find"); }}>Browse clubs</a>
        </div>
      ) : shown.length === 0 ? (
        <p className="hub-empty">
          {filtered ? "No sessions match these filters. Try clearing one." : date !== "any" && !text.trim() ? `No sessions on ${formatDay(date)}. Try another day, or All.` : "No sessions match. Try another day or All."}
        </p>
      ) : groupByDate(shown).map((g) => {
        const [head, ...rest] = dayHeading(g.date, today).split(", ");
        const isNamed = head === "Today" || head === "Tomorrow";
        return (
          <section className="session-group" key={g.date}>
            <h2 className="find-day">{isNamed ? head : formatDay(g.date)} <small>{isNamed ? `${rest.join(", ")} · ` : ""}{plural(g.events.length, "session")}</small></h2>
            <div className="find-list">
              {g.events.map((s) => <SessionCard key={`${s.clubId}/${s.id}`} session={s} mine={mine.has(s.clubId)} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
