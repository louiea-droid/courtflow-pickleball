import { ListOrdered, Plus, Search, Users } from "lucide-react";
import PageTitle from "../components/PageTitle";
import { ROLE_LABEL } from "../utils/clubs";

const greeting = (hour) => (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

// The home screen: a greeting, the two ways to start playing, then your clubs (and one to create).
// Profile lives in the account menu, so it is not repeated here.
export default function Hub({ name, clubs, ready, navigate }) {
  const to = (path) => (e) => { e.preventDefault(); navigate(path); };
  const first = (name || "").trim().split(/\s+/)[0];
  return (
    <>
      <PageTitle title={`${greeting(new Date().getHours())}${first ? `, ${first}` : ""}`} />

      <section className="panel home-ready" aria-labelledby="home-ready-title">
        <div>
          <h2 className="club-section" id="home-ready-title">Ready to play?</h2>
          <p>Find a club, join a queue, or start a quick game.</p>
        </div>
        <div className="home-ready-actions">
          <a className="primary" href="/clubs/find" onClick={to("/clubs/find")}><Search size={15} /> Find a club</a>
          <a className="outline" href="/club"><ListOrdered size={15} /> Quick session</a>
        </div>
      </section>

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
        <div className="hub-grid">
          {clubs.map((c) => (
            <a key={c.id} className="hub-card" href={`/clubs/${c.id}`} onClick={to(`/clubs/${c.id}`)}>
              <Users size={22} />
              <b>{c.clubName}</b>
              <span className="pill">{ROLE_LABEL[c.role] || ROLE_LABEL.member}</span>
            </a>
          ))}
          <a className="hub-card hub-card-new" href="/clubs/new" onClick={to("/clubs/new")}>
            <Plus size={22} />
            <b>Create a club</b>
          </a>
        </div>
      )}
    </>
  );
}
