import { useState } from "react";
import { CalendarSearch, ListOrdered, MessageSquare, Plus, UserPlus } from "lucide-react";
import ActiveQueue from "../components/ActiveQueue";
import { useToday } from "../hooks/useToday";
import { ROLE_LABEL, badgeColor, clubInitial, clubPath, permissions } from "../utils/clubs";
import { endHM } from "../utils/bookings";
import { formatHM, money } from "../utils/format";
import { friendBuckets } from "../utils/friends";
import { dayHeading, fillRatio, spotsLabel, weekDays } from "../utils/sessions";

const greeting = (hour) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
const UPCOMING = 5;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
// "Today" / "Tomorrow" alone, else "Sat, Oct 17", so a row's line stays short.
const shortDay = (date, today) => { const h = dayHeading(date, today); return /^(Today|Tomorrow)/.test(h) ? h.split(",")[0] : h; };


function Wave() {
  return (
    <svg className="home-hero-wave" viewBox="0 0 800 70" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 40 C150 10 280 60 430 32 S700 8 800 26 V70 H0Z" fill="var(--lime)" />
      <path d="M0 52 C160 26 300 72 460 46 S720 24 800 40 V70 H0Z" fill="var(--brand-green)" />
    </svg>
  );
}

// The home screen: a welcome band with the way to start playing, the game you're in right now, what's
// coming up this week, then friends, inbox and your clubs.
export default function Hub({ uid, name, clubs, ready, friendships = [], inbox = { chats: [], unread: 0 }, sessions: sessionsState, activeGames = [], navigate }) {
  const to = (path) => (e) => { e.preventDefault(); navigate(path); };
  const first = (name || "").trim().split(/\s+/)[0];
  const { friends, received } = friendBuckets(friendships, uid);
  const { sessions, ready: sessionsReady, error: sessionsError } = sessionsState;
  const mine = new Set(clubs.map((c) => c.id));
  const managed = new Set(clubs.filter((c) => permissions(c.role).canManage).map((c) => c.id));
  // A session you manage opens its event page; any other opens the booking page on that one session.
  const sessionLink = (s) => {
    if (!managed.has(s.clubId)) return { href: `/open-play?club=${encodeURIComponent(s.clubId)}&event=${encodeURIComponent(s.id)}` };
    const path = clubPath(s.clubId, `/event/${encodeURIComponent(s.id)}`);
    return { href: path, onClick: to(path) };
  };
  const today = useToday();
  const [day, setDay] = useState(null); // a date picked on the strip, or null for the next few
  const week = weekDays(today);
  const inWeek = new Set(week.map((d) => d.date));
  // Your own clubs' sessions first within a day.
  const sorted = [...sessions].sort((a, b) => (a.date + (mine.has(a.clubId) ? "0" : "1") + a.startTime).localeCompare(b.date + (mine.has(b.clubId) ? "0" : "1") + b.startTime));
  const shown = day ? sorted.filter((s) => s.date === day) : sorted.slice(0, UPCOMING);
  const weekCount = sessions.filter((s) => inWeek.has(s.date)).length;
  const game = activeGames[0];
  const summary = game ? `You're in a game at ${game.club.clubName}.`
    : weekCount ? `Not in a game right now. ${plural(weekCount, "open play session")} this week.`
      : "Find a game near you, or start a quick session.";

  return (
    <>
      <section className="home-hero" aria-labelledby="home-hero-title">
        <h1 id="home-hero-title">{greeting(new Date().getHours())}{first ? <>, <span>{first}.</span></> : "."}</h1>
        <p>{summary}</p>
        <div className="home-hero-actions">
          <a className="home-btn lime" href="/sessions" onClick={to("/sessions")}><CalendarSearch size={16} /> Find session</a>
          <a className="home-btn ghost" href="/club"><ListOrdered size={16} /> Quick session</a>
        </div>
        <Wave />
      </section>

      <div className="home-grid">
        <section className="home-game" aria-labelledby="home-game-title">
          <h2 className="club-section" id="home-game-title">Your game</h2>
          {activeGames.length ? <ActiveQueue games={activeGames} navigate={navigate} /> : (
            <div className="home-card home-game-empty">
              <div>
                <b>You're not in a game right now</b>
                <p>Join one from Coming up, or find a session.</p>
              </div>
              <a className="outline" href="/sessions" onClick={to("/sessions")}>Find session</a>
            </div>
          )}
        </section>

        <section className="home-card home-upcoming" aria-labelledby="home-upcoming-title">
          <div className="home-card-head">
            <h2 className="club-section" id="home-upcoming-title">Coming up</h2>
            <a href="/sessions" onClick={to("/sessions")}>See all</a>
          </div>
          <div className="home-days" role="group" aria-label="Pick a day">
            {week.map((d) => {
              const has = sessions.some((s) => s.date === d.date);
              return (
                <button key={d.date} type="button" className={has ? "has" : undefined} aria-pressed={day === d.date}
                  onClick={() => setDay(day === d.date ? null : d.date)}>
                  {d.date === today ? "Today" : d.wd}<b>{d.day}</b>
                </button>
              );
            })}
          </div>
          {!sessionsReady ? (
            <div className="home-rows" aria-hidden="true"><div className="session-skeleton" /><div className="session-skeleton" /></div>
          ) : sessionsError ? (
            <p className="home-note">Couldn't load sessions right now.</p>
          ) : shown.length === 0 ? (
            <p className="home-note">{day ? `Nothing on ${dayHeading(day, today)}.` : "Nothing scheduled yet. Open play from public clubs shows up here."}</p>
          ) : (
            <div className="home-rows">
              {shown.map((s) => {
                const fill = fillRatio(s);
                return (
                  <a className="home-row" key={`${s.clubId}/${s.id}`} {...sessionLink(s)}>
                    <span className="home-badge" style={{ background: badgeColor(s.clubId) }} aria-hidden="true">{clubInitial(s.clubName)}</span>
                    <span className="home-row-main">
                      <b>{s.title || "Open play"}{s.status === "live" && <span className="pill live">Live</span>}</b>
                      <small>{s.clubName}{mine.has(s.clubId) && " · Your club"} · {day ? "" : `${shortDay(s.date, today)}, `}{formatHM(s.startTime)} to {formatHM(endHM(s))}</small>
                    </span>
                    <span className="home-row-side">
                      <b>{s.fee ? money(s.fee) : "Free"}</b>
                      <small className={fill === 1 ? "full" : undefined}>{spotsLabel(s)}</small>
                      {fill !== null && <span className="home-fill" aria-hidden="true"><i style={{ width: `${Math.round(fill * 100)}%` }} /></span>}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="home-tiles">
        <a className="home-tile" href="/friends" onClick={to("/friends")}>
          <UserPlus size={20} />
          <span><b>Friends</b><small>{plural(friends.length, "friend")}</small></span>
          {received.length > 0 && <span className="count-badge">{plural(received.length, "request")}</span>}
        </a>
        <a className="home-tile" href="/inbox" onClick={to("/inbox")}>
          <MessageSquare size={20} />
          <span><b>Inbox</b><small>{plural((inbox.chats || []).length, "chat")}</small></span>
          {inbox.unread > 0 && <span className="count-badge">{inbox.unread} new</span>}
        </a>
      </div>

      <h2 className="club-section">My clubs</h2>
      {!ready ? (
        <p className="hub-empty">Loading your clubs…</p>
      ) : clubs.length === 0 ? (
        <div className="panel hub-start">
          <b>Create your first club</b>
          <p>A club holds your open play, games and settings. You'll be its owner.</p>
          <div className="hub-start-actions">
            <a className="primary" href="/clubs/new" onClick={to("/clubs/new")}><Plus size={15} /> Create a club</a>
          </div>
        </div>
      ) : (
        <div className="club-list">
          {clubs.map((c) => (
            <a key={c.id} className="club-row" href={`/clubs/${c.id}`} onClick={to(`/clubs/${c.id}`)}>
              <span className="home-badge small" style={{ background: badgeColor(c.id) }} aria-hidden="true">{clubInitial(c.clubName)}</span>
              <b>{c.clubName}</b>
              <span className="pill">{ROLE_LABEL[c.role] || ROLE_LABEL.member}</span>
            </a>
          ))}
          <a className="outline club-row-new" href="/clubs/new" onClick={to("/clubs/new")}><Plus size={15} /> Create a club</a>
        </div>
      )}
    </>
  );
}
