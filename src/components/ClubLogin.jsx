import { useState } from "react";
import { LogIn } from "lucide-react";

export default function ClubLogin({ onLogin, loading }) {
  const [name, setName] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (name.trim() && !loading) onLogin(name.trim());
  };

  return (
    <div className="clublogin">
      <form className="clublogin-card" onSubmit={submit}>
        <img className="mark" src="/images/courtflow.png" alt="" />
        <h1>CourtFlow</h1>
        <p>Enter your club or venue name to start or continue a session.</p>
        <label>
          Club name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Centro Pickle Club"
            autoFocus
          />
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
