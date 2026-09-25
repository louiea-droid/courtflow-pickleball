import { useEffect, useRef, useState } from "react";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { LogIn, Moon, Search, Sun } from "lucide-react";
import { db } from "../firebase";
import { isDarkTheme, setDeviceTheme } from "../utils/theme";

export default function ClubLogin({ onLogin, loading, error }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [directory, setDirectory] = useState([]);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(isDarkTheme);
  const toggleTheme = () => { setDeviceTheme(dark ? "light" : "dark"); setDark(!dark); };
  const wrapRef = useRef(null);
  const passwordRef = useRef(null);

  // One-time fetch of every club that has ever started a session, so typing
  // can surface a match instead of requiring the exact remembered name.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(200)));
        if (!cancelled) {
          setDirectory(snap.docs.map((d) => ({
            id: d.id, name: d.data().location || d.id, hint: d.data().passwordHint || "",
          })));
        }
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
  const selectedHint = directory.find((c) => c.name.toLowerCase() === typed)?.hint;

  const submit = (e) => {
    e.preventDefault();
    if (name.trim() && password && !loading) { setOpen(false); onLogin(name.trim(), password); }
  };

  const pick = (clubName) => {
    setName(clubName);
    setOpen(false);
    passwordRef.current?.focus();
  };

  return (
    <div className="clublogin">
      <form className="clublogin-card" onSubmit={submit}>
        <img className="mark" src="/images/courtflow.png" alt="" />
        <h1>CourtFlow</h1>
        <p>Enter your club or venue name and password to start or continue a session.</p>
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
        <label className="clublogin-password">
          Password
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoComplete="current-password"
          />
        </label>
        {selectedHint && <p className="clublogin-pwhint">Hint: {selectedHint}</p>}
        {error && <p className="clublogin-error">{error}</p>}
        <button className="primary" disabled={loading || !name.trim() || !password}>
          <LogIn size={16} /> {loading ? "Loading…" : "Continue"}
        </button>
        <p className="clublogin-hint">
          New club name + password → creates a new club. Existing club name → enter its
          password to continue right where you left off.
        </p>
      </form>
      <button
        type="button" className="icon theme-toggle" onClick={toggleTheme}
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
