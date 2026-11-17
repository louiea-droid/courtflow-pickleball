import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { Search } from "lucide-react";
import { db } from "../firebase";
import { friendBuckets } from "../utils/friends";
import Modal from "./Modal";
import UserAvatar from "./UserAvatar";

// Start (or open) a direct message: your friends, then the people in your clubs. The rules allow a conversation
// between accepted friends or two members of the same club, with each name exactly as it appears on that friendship
// or member record, so every person carries the names and the club to start it with.
export default function NewMessageModal({ uid, clubs, friendships, startDm, navigate, close }) {
  const [people, setPeople] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    const byId = new Map();
    for (const f of friendBuckets(friendships, uid).friends) {
      byId.set(f.otherId, { id: f.otherId, name: f.name, how: "Friend", names: { me: f.names?.[uid], other: f.name } });
    }
    // ponytail: one read per club; fine for a person's handful of clubs, page it if someone joins dozens
    Promise.all(clubs.map(async (c) => {
      const docs = (await getDocs(collection(db, "clubs", c.id, "members")).catch(() => null))?.docs || [];
      const me = docs.find((d) => d.id === uid)?.data().name;
      for (const d of docs) {
        if (d.id === uid || byId.has(d.id) || !me) continue;
        byId.set(d.id, { id: d.id, name: d.data().name || "Member", how: c.clubName, names: { me, other: d.data().name }, viaClub: c.id });
      }
    })).then(() => {
      if (live) setPeople([...byId.values()].sort((a, b) => (b.how === "Friend") - (a.how === "Friend") || a.name.localeCompare(b.name)));
    });
    return () => { live = false; };
  }, [uid, clubs, friendships]);

  const q = text.trim().toLowerCase();
  const shown = (people || []).filter((p) => !q || p.name.toLowerCase().includes(q) || p.how.toLowerCase().includes(q));
  const open = async (p) => {
    setBusy(p.id);
    setError("");
    try {
      navigate(`/inbox/${await startDm(p.id, p.names, p.viaClub)}`);
      close();
    } catch {
      setError("Couldn't open the conversation. Try again.");
      setBusy("");
    }
  };

  return (
    <Modal title="New message" label="INBOX" close={close} className="newmsg-modal">
      <label className="inbox-search newmsg-search">
        <Search size={15} />
        <input type="search" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Search people or clubs" aria-label="Search people" />
      </label>
      {error && <p className="chat-error" role="alert">{error}</p>}
      {!people ? (
        <p className="inbox-empty">Loading…</p>
      ) : people.length === 0 ? (
        <p className="inbox-empty">Add friends or join a club to message people here.</p>
      ) : shown.length === 0 ? (
        <p className="inbox-empty">Nobody matches that.</p>
      ) : (
        <ul className="newmsg-list">
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" className="newmsg-row" disabled={Boolean(busy)} onClick={() => open(p)}>
                <UserAvatar uid={p.id} size={36} />
                <span className="newmsg-text"><b>{p.name}</b><small>{p.how === "Friend" ? "Friend" : `Member of ${p.how}`}</small></span>
                {busy === p.id && <small className="newmsg-busy">Opening…</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
