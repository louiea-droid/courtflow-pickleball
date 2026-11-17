import { useState } from "react";
import { CalendarPlus, ChevronRight, MapPin, Plus, Search, Users } from "lucide-react";
import PageTitle from "../components/PageTitle";
import { useDirectory } from "../hooks/useMembership";

import { formatHM } from "../utils/format";
import { splitAttendees } from "../utils/bookings";
import { fillRatio, spotsLabel } from "../utils/sessions";
import { ROLE_LABEL, badgeColor, clubPath, filterClubs, permissions } from "../utils/clubs";
import ClubBadge from "../components/ClubBadge";

const dayParts = (date) => {
  const d = new Date(`${date}T12:00:00`);
  return { wd: d.toLocaleDateString("en-US", { weekday: "short" }), day: d.getDate() };
};
const when = (s) => `${dayParts(s.date).wd} ${dayParts(s.date).day}, ${formatHM(s.startTime)}`;
const byNext = (nextOf) => (a, b) => {
  const na = nextOf(a.id), nb = nextOf(b.id);
  if (na && nb) return (na.date + na.startTime).localeCompare(nb.date + nb.startTime);
  if (na || nb) return na ? -1 : 1;
  return (a.name || "").localeCompare(b.name || "");
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Clubs, one screen (both /clubs and /clubs/find), no visible title (the sidebar names the place):
// - Clubs you manage (owner or manager): a deep green host panel, each club with its next game, how many booked,
//   join requests waiting, and the two things a host does most (Open play, Members).
// - Clubs you're in (member; private ones too, joined by invite): short rows, the whole row opens the club.
// - Find a club to join: public clubs you're not in, as full cards with the club's cover and the next game.
// One search filters all three; an empty section hides. Within a section, clubs playing soonest come first.
export default function FindClubs({ myClubs, myReady, sessions = [], joinRequests = [], navigate }) {
  const [text, setText] = useState("");
  const { clubs, ready, error } = useDirectory();
  const mine = new Map(myClubs.map((c) => [c.id, c.role]));
  const details = new Map(clubs.map((c) => [c.id, c]));
  const nextOf = (id) => sessions.filter((s) => s.clubId === id).sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))[0];
  const find = (list) => [...filterClubs(list, text)].sort(byNext(nextOf));
  // Private clubs aren't in the public directory: photo stays undefined so ClubBadge looks it up.
  const yours = myClubs.map((c) => ({ id: c.id, name: c.clubName, ...details.get(c.id), listed: details.has(c.id) }));
  const manage = find(yours.filter((c) => permissions(mine.get(c.id)).canManage));
  const member = find(yours.filter((c) => !permissions(mine.get(c.id)).canManage));
  const toJoin = find(clubs.filter((c) => !mine.has(c.id)));
  const loading = !myReady || !ready;
  const go = (path) => (e) => { e.preventDefault(); navigate(path); };
  const requestsFor = (id) => joinRequests.filter((r) => r.clubId === id).length;
  const empty = !manage.length && !member.length && !toJoin.length;

  const hostTile = (c) => {
    const next = nextOf(c.id);
    const asks = requestsFor(c.id);
    const booked = next?.maxPlayers ? `${splitAttendees(next).confirmed.length} of ${next.maxPlayers} booked` : next ? "Open" : "";
    return (
      <li key={c.id} className="host-tile">
        <a className="host-tile-head" href={clubPath(c.id)} onClick={go(clubPath(c.id))}>
          <ClubBadge className="host-tile-badge" id={c.id} name={c.name} photo={c.listed ? c.photo || "" : undefined} />
          <span className="host-tile-name"><b>{c.name}</b><small>{ROLE_LABEL[mine.get(c.id)]}</small></span>
          <ChevronRight size={18} aria-hidden="true" />
        </a>
        <p className="host-tile-next">
          {next ? <>{next.status === "live" ? <span className="host-live">Live now</span> : <>Next: {when(next)}</>} · {booked}</> : "No open play scheduled"}
        </p>
        <div className="host-tile-actions">
          <a className="host-btn main" href={clubPath(c.id, "/host")} onClick={go(clubPath(c.id, "/host"))}><CalendarPlus size={15} /> Open play</a>
          <a className="host-btn" href={clubPath(c.id, "/members")} onClick={go(clubPath(c.id, "/members"))}>
            <Users size={15} /> Members{asks > 0 && <span className="host-asks" aria-label={`${plural(asks, "join request")} waiting`}>{asks}</span>}
          </a>
        </div>
      </li>
    );
  };

  const memberRow = (c) => {
    const next = nextOf(c.id);
    return (
      <a key={c.id} className="club-mini" href={clubPath(c.id)} onClick={go(clubPath(c.id))}>
        <ClubBadge className="club-mini-badge" id={c.id} name={c.name} photo={c.listed ? c.photo || "" : undefined} />
        <span className="club-mini-main">
          <b>{c.name}</b>
          <small>{next ? (next.status === "live" ? "Game on now" : `Next game ${when(next)}`) : "No open play scheduled yet"}</small>
        </span>
        <ChevronRight size={18} className="club-mini-go" aria-hidden="true" />
      </a>
    );
  };

  const joinCard = (c) => {
    const next = nextOf(c.id);
    const fill = next ? fillRatio(next) : null;
    return (
      <a key={c.id} className="club-card" href={clubPath(c.id)} onClick={go(clubPath(c.id))} style={{ "--club": badgeColor(c.id) }}>
        <span className="club-card-cover" aria-hidden="true">
          <svg viewBox="0 0 320 64" preserveAspectRatio="none"><path d="M0 40 C60 22 110 52 170 34 S280 18 320 28 V64 H0Z" /></svg>
        </span>
        <ClubBadge className="club-card-badge" id={c.id} name={c.name} photo={c.photo || ""} />
        <span className="club-card-title">
          <b>{c.name}</b>
          {c.location && <small><MapPin size={12} /> {c.location}</small>}
        </span>
        {c.description && <p>{c.description}</p>}
        {next ? (
          <span className="club-card-next">
            <span className="club-card-day"><small>{dayParts(next.date).wd}</small><b>{dayParts(next.date).day}</b></span>
            <span className="club-card-next-main">
              <b>{next.title || "Open play"}</b>
              <small>{formatHM(next.startTime)} · {spotsLabel(next)}</small>
              {fill !== null && <span className="club-card-fill"><i style={{ width: `${Math.round(fill * 100)}%` }} /></span>}
            </span>
          </span>
        ) : (
          <span className="club-card-next none">No open play scheduled yet</span>
        )}
        <span className="club-card-cta join">Join</span>
      </a>
    );
  };

  const heading = (label, n, id) => <h2 className="club-section" id={id}>{label}<span className="clubs-count">{n}</span></h2>;

  return (
    <div className="clubs-page">
      <PageTitle title="Clubs" hidden />
      <div className="clubs-bar">
        <label className="find-search">
          <Search size={16} />
          <input
            type="search" value={text} onChange={(e) => setText(e.target.value)}
            placeholder="Search clubs by name or place" aria-label="Search clubs"
          />
        </label>
        <a className="outline clubs-create" href="/clubs/new" onClick={go("/clubs/new")}><Plus size={15} /> Create a club</a>
      </div>

      {loading ? (
        <p className="hub-empty">Loading clubs…</p>
      ) : error && !myClubs.length ? (
        <div className="panel notice"><p>Couldn't load the clubs. Check your connection and try again.</p></div>
      ) : empty ? (
        <p className="hub-empty">
          {text.trim() ? "No club matches that. Try another name or place." : "No clubs yet."}{" "}
          <a href="/clubs/new" onClick={go("/clubs/new")}>Create a club</a>{text.trim() ? "." : " to start your own."}
        </p>
      ) : (
        <>
          {manage.length > 0 && (
            <section className="host-panel" aria-labelledby="clubs-manage">
              {heading("Clubs you manage", manage.length, "clubs-manage")}
              <ul className="host-tiles">{manage.map(hostTile)}</ul>
            </section>
          )}
          {member.length > 0 && (
            <section className="clubs-group" aria-labelledby="clubs-in">
              {heading("Clubs you're in", member.length, "clubs-in")}
              <div className="club-minis">{member.map(memberRow)}</div>
            </section>
          )}
          {toJoin.length > 0 && (
            <section className="clubs-group" aria-labelledby="clubs-join">
              {heading("Find a club to join", toJoin.length, "clubs-join")}
              <p className="clubs-join-note">Anyone can join a public club. Private clubs are invite only.</p>
              <div className="club-cards">{toJoin.map(joinCard)}</div>
            </section>
          )}
          {/* Phones only: the Create a club button beside the search is hidden there */}
          <a className="club-card-new" href="/clubs/new" onClick={go("/clubs/new")}>
            <Plus size={18} /><span><b>Start your own club</b><small>Run open play, take bookings and keep a fair queue.</small></span>
          </a>
        </>
      )}
    </div>
  );
}
