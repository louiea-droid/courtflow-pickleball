import { ListOrdered, Plus, UserRound, Users } from "lucide-react";

const ROLE_LABEL = { owner: "Owner", manager: "Manager", member: "Member" };

// The home screen: your clubs, creating one, your profile, and the quick session.
export default function Hub({ name, clubs, ready, navigate }) {
  const to = (path) => (e) => { e.preventDefault(); navigate(path); };
  return (
    <>
      <h1>{name ? `Hi, ${name}` : "Your clubs"}</h1>
      <p>Pick a club to manage or visit, or start one of your own.</p>

      <h2 className="club-section">My clubs</h2>
      <div className="hub-grid">
        {clubs.map((c) => (
          <a key={c.id} className="hub-card" href={`/clubs/${c.id}`} onClick={to(`/clubs/${c.id}`)}>
            <Users size={22} />
            <b>{c.clubName}</b>
            <span>{ROLE_LABEL[c.role] || "Member"}</span>
          </a>
        ))}
        <a className="hub-card" href="/clubs/new" onClick={to("/clubs/new")}>
          <Plus size={22} />
          <b>Create a club</b>
          <span>Start a club, then host open play and run games for it.</span>
        </a>
      </div>
      {ready && !clubs.length && <p className="hub-empty">You're not in any club yet. Create one to get started.</p>}

      <h2 className="club-section">Also</h2>
      <div className="hub-grid">
        <a className="hub-card" href="/settings" onClick={to("/settings")}>
          <UserRound size={22} />
          <b>Profile</b>
          <span>Your name, password and appearance.</span>
        </a>
        <a className="hub-card" href="/club">
          <ListOrdered size={22} />
          <b>Quick session</b>
          <span>Run the queue right now, no club needed. Saved on this device.</span>
        </a>
      </div>
    </>
  );
}
