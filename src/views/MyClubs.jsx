import { Plus, Search, Users } from "lucide-react";
import PageTitle from "../components/PageTitle";
import { ROLE_LABEL, clubPath } from "../utils/clubs";

// Every club the person owns, manages or belongs to (the sidebar's "My clubs").
export default function MyClubs({ clubs, ready, navigate }) {
  const to = (path) => (e) => { e.preventDefault(); navigate(path); };
  return (
    <>
      <PageTitle
        title="My clubs"
        sub={ready ? (clubs.length === 1 ? "1 club" : `${clubs.length} clubs`) : undefined}
      >
        <a className="outline" href="/clubs/find" onClick={to("/clubs/find")}><Search size={15} /> Find a club</a>
        <a className="primary" href="/clubs/new" onClick={to("/clubs/new")}><Plus size={15} /> Create a club</a>
      </PageTitle>
      {!ready ? (
        <p className="hub-empty">Loading your clubs…</p>
      ) : clubs.length === 0 ? (
        <div className="panel hub-start">
          <b>You're not in a club yet</b>
          <p>Create one to host open play, or find a club to ask to join.</p>
        </div>
      ) : (
        <div className="hub-grid">
          {clubs.map((c) => (
            <a key={c.id} className="hub-card" href={clubPath(c.id)} onClick={to(clubPath(c.id))}>
              <Users size={22} />
              <b>{c.clubName}</b>
              <span className="pill">{ROLE_LABEL[c.role] || ROLE_LABEL.member}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
