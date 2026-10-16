import { useState } from "react";
import { MapPin, Plus, Search } from "lucide-react";
import PageTitle from "../components/PageTitle";
import { useDirectory } from "../hooks/useMembership";
import { ROLE_LABEL, badgeColor, clubInitial, clubPath, filterClubs } from "../utils/clubs";
import { formatHM } from "../utils/format";

const shortDay = (date) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" });

// Clubs, two tabs on one screen: All clubs (/clubs/find: every public club, searched on the device; a card opens the club
// page, where a non-member asks to join) and My clubs (/clubs: every club you belong to, public or private). Private clubs
// are joined with an invite link, so only their members see them. Each card shows the club's next public session.
export default function FindClubs({ tab, myClubs, myReady, sessions = [], navigate }) {
  const [text, setText] = useState("");
  const { clubs, ready, error } = useDirectory();
  const mine = new Map(myClubs.map((c) => [c.id, c.role]));
  const details = new Map(clubs.map((c) => [c.id, c]));
  const list = tab === "mine"
    ? myClubs.map((c) => ({ id: c.id, name: c.clubName, ...details.get(c.id) }))
    : clubs;
  const shown = filterClubs(list, text);
  const loading = tab === "mine" ? !myReady : !ready;
  const nextOf = (id) => sessions.filter((s) => s.clubId === id).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };

  return (
    <div className="page-narrow clubs-page">
      <PageTitle title="Clubs" sub="Find a club near you and ask to join. Private clubs join with an invite link.">
        <a className="primary" href="/clubs/new" onClick={go("/clubs/new")}><Plus size={15} /> Create a club</a>
      </PageTitle>
      <label className="find-search">
        <Search size={16} />
        <input
          type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Search by club name or place" aria-label="Search clubs"
        />
      </label>
      <nav className="clubs-tabs" aria-label="Clubs">
        <a href="/clubs/find" aria-current={tab === "all" ? "page" : undefined} onClick={go("/clubs/find")}>All clubs{ready ? ` · ${clubs.length}` : ""}</a>
        <a href="/clubs" aria-current={tab === "mine" ? "page" : undefined} onClick={go("/clubs")}>My clubs{myReady ? ` · ${myClubs.length}` : ""}</a>
      </nav>

      {loading ? (
        <p className="hub-empty">Loading clubs…</p>
      ) : tab === "all" && error ? (
        <div className="panel notice"><p>Couldn't load the clubs. Check your connection and try again.</p></div>
      ) : !shown.length ? (
        <p className="hub-empty">
          {text.trim() ? "No club matches that. Try another name or place." : tab === "mine" ? "You're not in a club yet. Join one from All clubs, or" : "No public clubs yet."}{" "}
          <a href="/clubs/new" onClick={go("/clubs/new")}>create a club</a>{text.trim() || tab === "mine" ? "." : " to start your own."}
        </p>
      ) : (
        <div className="club-cards">
          {shown.map((c) => {
            const role = mine.get(c.id);
            const next = nextOf(c.id);
            return (
              <a key={c.id} className="club-card" href={clubPath(c.id)} onClick={go(clubPath(c.id))}>
                <span className="club-card-badge" style={{ background: badgeColor(c.id) }} aria-hidden="true">{clubInitial(c.name)}</span>
                <span className="club-card-title">
                  <b>{c.name}{role && <span className="pill">{ROLE_LABEL[role] || ROLE_LABEL.member}</span>}</b>
                  {c.location && <small><MapPin size={12} /> {c.location}</small>}
                </span>
                {c.description && <p>{c.description}</p>}
                <span className="club-card-foot">
                  {next ? <span className="pill off">Next: {shortDay(next.date)} {formatHM(next.startTime)}</span> : <span />}
                  <span className={role ? "club-card-link" : "outline club-card-join"}>{role ? "Open club →" : "Ask to join"}</span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
