import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import PageTitle from "../components/PageTitle";
import { useDirectory } from "../hooks/useMembership";
import { ROLE_LABEL, clubPath, filterClubs } from "../utils/clubs";

// Public clubs, searched on the device (the name or place contains the text). A row opens the club page,
// where the person can ask to join. Private clubs are joined with an invite link, so they are not here.
export default function FindClubs({ myClubs, navigate }) {
  const [text, setText] = useState("");
  const { clubs, ready, error } = useDirectory();
  const mine = new Map(myClubs.map((c) => [c.id, c.role]));
  const shown = filterClubs(clubs, text);
  const open = (id) => (e) => { e.preventDefault(); navigate(clubPath(id)); };

  return (
    <div className="page-narrow">
      <PageTitle title="Clubs" sub="Every public club: search, open one and ask to join. Private clubs are joined with an invite link." />
      <label className="find-search">
        <Search size={16} />
        <input
          type="search" value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Search by club name or place" aria-label="Search clubs" autoFocus
        />
      </label>
      {!ready ? (
        <p className="hub-empty">Loading clubs…</p>
      ) : error ? (
        <div className="panel notice"><p>Couldn't load the clubs. Check your connection and try again.</p></div>
      ) : !shown.length ? (
        <p className="hub-empty">{text.trim() ? "No public club matches that. Try another name or place." : "No public clubs yet."}</p>
      ) : (
        <div className="find-list">
          {shown.map((c) => (
            <a key={c.id} className="find-row" href={clubPath(c.id)} onClick={open(c.id)}>
              <span className="find-main">
                <b>{c.name}</b>
                {c.location && <small><MapPin size={12} /> {c.location}</small>}
                {c.description && <small className="find-about">{c.description}</small>}
              </span>
              {mine.has(c.id) && <span className="pill">{ROLE_LABEL[mine.get(c.id)] || ROLE_LABEL.member}</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
