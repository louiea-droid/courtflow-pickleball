import { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { LogIn, Search } from "lucide-react";
import { db } from "../firebase";

export default function ClubLogin({ onLogin, loading }) {
  const [name, setName] = useState("");
  const [directory, setDirectory] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // One-time fetch of every club that has ever started a session, so typing
  // can surface a match instead of requiring the exact remembered name.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(200)));
        if (!cancelled) setDirectory(snap.docs.map((d) => ({ id: d.id, name: d.data().location || d.id })));
      } catch {
        // Directory is a nice-to-have; typing the exact name still works without it.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const typed = name.trim().toLowerCase();
  const matches = typed
    ? directory.filter((c) => c.name.toLowerCase().includes(typed)).slice(0, 8)
    : [];

  const submit = (e) => {
    e.preventDefault();
    if (name.trim() && !loading) { setOpen(false); onLogin(name.trim()); }
  };

  const pick = (clubName) => {
    setName(clubName);
    setOpen(false);
    if (!loading) onLogin(clubName);
  };

  return (
    <div className="clublogin">
      <form className="clublogin-card" onSubmit={submit}>
        <img className="mark" src="/images/courtflow.png" alt="" />
        <h1>CourtFlow</h1>
        <p>Enter your club or venue name to start or continue a session.</p>
        <label className="clublogin-search" ref={wrapRef}>
          Club name
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="e.g. Centro Pickle Club"
            autoComplete="off"
            autoFocus
          />
          {open && matches.length > 0 && (
            <div className="clublogin-suggestions">
              {matches.map((c) => (
                <button type="button" key={c.id} className="clublogin-suggestion" onClick={() => pick(c.name)}>
                  <Search size={13} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </label>
        <button className="primary" disabled={loading || !name.trim()}>
          <LogIn size={16} /> {loading ? "Loading…" : "Continue"}
        </button>
        <p className="clublogin-hint">
          New club name → starts a fresh session. Existing club name → we'll ask whether to
          continue where you left off or start over.
        </p>
      </form>
    </div>
  );
}
