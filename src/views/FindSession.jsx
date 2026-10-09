import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import PageTitle from "../components/PageTitle";
import SessionCard from "../components/SessionCard";
import { useSessions } from "../hooks/useSessions";
import { dateChips, dayHeading, filterSessions, groupByDate } from "../utils/sessions";

const localToday = () => new Date().toLocaleDateString("en-CA");

// Open play and bookings from public clubs, joined or not: pick a day, search by club, place or session name.
export default function FindSession({ clubs, navigate }) {
  const { sessions, ready, error } = useSessions();
  const today = localToday();
  const [date, setDate] = useState("any");
  const [text, setText] = useState("");
  const mine = new Set(clubs.map((c) => c.id));
  const chips = useMemo(() => dateChips(sessions, today), [sessions, today]);
  const shown = filterSessions(sessions, text, date);
  const label = (d) => (d === "any" ? "Any day" : dayHeading(d, today));

  return (
    <div className="page-narrow">
      <PageTitle title="Find session" sub="Open play and bookings from public clubs, joined or not." />
      <label className="find-search">
        <Search size={16} />
        <input
          type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Search by club, place or session" aria-label="Search sessions"
        />
      </label>
      <div className="day-chips" role="group" aria-label="Day">
        {chips.map((d) => (
          <button key={d} type="button" className="day-chip" aria-pressed={d === date} onClick={() => setDate(d)}>{label(d)}</button>
        ))}
      </div>

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
        <p className="hub-empty">No sessions match. Try another day or Any day.</p>
      ) : groupByDate(shown).map((g) => (
        <section className="session-group" key={g.date}>
          <h2 className="club-section">{dayHeading(g.date, today)}</h2>
          <div className="find-list">
            {g.events.map((s) => <SessionCard key={`${s.clubId}/${s.id}`} session={s} mine={mine.has(s.clubId)} navigate={navigate} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
