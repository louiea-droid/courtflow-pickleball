import { useState } from "react";
import { createPortal } from "react-dom";

// onConfirm(password) resolves to "" on success or an error message to show here.
export default function DeleteAccountDialog({ clubName, loading, onCancel, onConfirm }) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const matches = typed.trim() === clubName;

  const submit = async (e) => {
    e.preventDefault();
    if (!matches || !password || loading) return;
    setError("");
    const err = await onConfirm(password);
    if (err) setError(err);
  };

  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !loading && onCancel()}>
      <form className="modal confirm-modal" onSubmit={submit}>
        <h3>Delete {clubName}?</h3>
        <p>
          This permanently deletes every player, court, match, and cost record for this club, and
          frees up the club name for anyone to use again. There is no undo.
        </p>
        <label>
          Type <b>{clubName}</b> to confirm
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoFocus
            autoComplete="off"
            disabled={loading}
          />
        </label>
        <label>
          Club password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </label>
        {error && <p className="clublogin-error" role="alert">{error}</p>}
        <div className="modalactions">
          <button type="button" className="outline" onClick={onCancel} disabled={loading}>Cancel</button>
          <button type="submit" className="danger" disabled={!matches || !password || loading}>
            {loading ? "Deleting…" : "Delete Forever"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
