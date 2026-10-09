import { CalendarSearch, ListOrdered, MessageSquare, Plus, UserPlus, Users } from "lucide-react";
import ActiveQueue from "../components/ActiveQueue";
import PageTitle from "../components/PageTitle";
import SessionCard from "../components/SessionCard";
import { useToday } from "../hooks/useToday";
import { ROLE_LABEL } from "../utils/clubs";
import { friendBuckets } from "../utils/friends";
import { dayHeading, groupByDate } from "../utils/sessions";

const greeting = (hour) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
const UPCOMING = 5;

// The home screen: the way to start playing, the session you are in right now, what is coming up on other dates,
// then friends, inbox and your clubs.
export default function Hub({ uid, name, clubs, ready, friendships = [], inbox = { chats: [], unread: 0 }, sessions: sessionsState, activeGames = [], navigate }) {
  const to = (path) => (e) => { e.preventDefault(); navigate(path); };
  const first = (name || "").trim().split(/\s+/)[0];
  const { friends, received } = friendBuckets(friendships, uid);
  const { sessions, ready: sessionsReady, error: sessionsError } = sessionsState;
  const mine = new Set(clubs.map((c) => c.id));
  const today = useToday();
  // The next few sessions, your own clubs' first within a day.
  const upcoming = [...sessions]
    .sort((a, b) => (a.date + (mine.has(a.clubId) ? "0" : "1") + a.startTime).localeCompare(b.date + (mine.has(b.clubId) ? "0" : "1") + b.startTime))
    .slice(0, UPCOMING);

  return (
    <>
      <PageTitle title={`${greeting(new Date().getHours())}${first ? `, ${first}` : ""}`} />

      <section className="panel home-ready" aria-labelledby="home-ready-title">
        <div>
          <h2 className="club-section" id="home-ready-title">Ready to play?</h2>
          <p>Find a session to join, or start a quick game.</p>
        </div>
        <div className="home-ready-actions">
          <a className="primary" href="/sessions" onClick={to("/sessions")}><CalendarSearch size={15} /> Find session</a>
          <a className="outline" href="/club"><ListOrdered size={15} /> Quick session</a>
        </div>
      </section>

      <section className="home-active" aria-label="Your active session">
        <h2 className="club-section">Your active session</h2>
        <ActiveQueue games={activeGames} navigate={navigate} />
        <div className="panel home-active-empty">
          <p>You're not in a session right now. Join one from Coming up, or use Find session above.</p>
        </div>
      </section>

      <section className="home-upcoming" aria-label="Coming up">
        <h2 className="club-section">Coming up</h2>
        {!sessionsReady ? (
          <div className="find-list" aria-hidden="true">
            <div className="session-skeleton" /><div className="session-skeleton" /><div className="session-skeleton" />
          </div>
        ) : sessionsError || upcoming.length === 0 ? (
          <div className="panel home-active-note">
            <p>{sessionsError ? "Couldn't load sessions right now." : "Nothing scheduled yet. Open play from public clubs shows up here."}</p>
          </div>
        ) : (
          <>
            {groupByDate(upcoming).map((g) => (
              <div className="session-group" key={g.date}>
                <h3 className="home-day">{dayHeading(g.date, today)}</h3>
                <div className="find-list">
                  {g.events.map((s) => <SessionCard key={`${s.clubId}/${s.id}`} session={s} mine={mine.has(s.clubId)} compact />)}
                </div>
              </div>
            ))}
            <a className="outline home-see-all" href="/sessions" onClick={to("/sessions")}>See all sessions</a>
          </>
        )}
      </section>

      <div className="home-tiles">
        <a className="home-tile" href="/friends" onClick={to("/friends")}>
          <UserPlus size={20} />
          <span><b>Friends</b><small>{friends.length} {friends.length === 1 ? "friend" : "friends"}</small></span>
          {received.length > 0 && <span className="count-badge">{received.length}</span>}
        </a>
        <a className="home-tile" href="/inbox" onClick={to("/inbox")}>
          <MessageSquare size={20} />
          <span><b>Inbox</b><small>{(inbox.chats || []).length} {(inbox.chats || []).length === 1 ? "chat" : "chats"}</small></span>
          {inbox.unread > 0 && <span className="count-badge">{inbox.unread}</span>}
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
              <Users size={18} />
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
