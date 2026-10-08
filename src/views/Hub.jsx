import { ChevronRight, ListOrdered, Plus, Users } from "lucide-react";
import PageTitle from "../components/PageTitle";
import { ROLE_LABEL } from "../utils/clubs";

// The home screen: your clubs first, a smaller card to create another, and the quick session.
// Profile lives in the account menu, so it is not repeated here.
export default function Hub({ name, clubs, ready, navigate }) {
  const to = (path) => (e) => { e.preventDefault(); navigate(path); };
  return (
    <>
      <PageTitle title={name ? `Hi, ${name}` : "Your clubs"} sub="Pick a club to manage or visit, or start one of your own." />

      <h2 className="club-section">Your clubs</h2>
      {!ready ? (
        <p className="hub-empty">Loading your clubs…</p>
      ) : clubs.length === 0 ? (
        <div className="panel hub-start">
          <b>Create your first club</b>
          <p>A club holds your open play, games and settings. You'll be its owner.</p>
          <a className="primary" href="/clubs/new" onClick={to("/clubs/new")}><Plus size={15} /> Create a club</a>
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

      <a className="hub-row" href="/club">
        <ListOrdered size={22} />
        <span className="hub-row-copy">
          <b>Quick session</b>
          <span>Run the queue right now, no club needed. Saved on this device.</span>
        </span>
        <ChevronRight size={18} />
      </a>
    </>
  );
}
