import { useState } from "react";
import { createPortal } from "react-dom";
import { useEscape } from "../hooks/useEscape";

// onConfirm(password) resolves to "" on success or an error message to show here.
// needsPassword is false for Google-only accounts: the Google window confirms instead.
export default function DeleteAccountDialog({ clubName, loading, onCancel, onConfirm, variant = "club", needsPassword = true, ownedClubs = [] }) {
  useEscape(() => { if (!loading) onCancel(); });
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const isAccount = variant === "account";
  const matches = typed.trim() === clubName;
  const ready = matches && (!needsPassword || password) && !loading;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setError("");
    const err = await onConfirm(password);
    if (err) setError(err);
  };

  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !loading && onCancel()}>
      <form className="modal confirm-modal" onSubmit={submit}>
        <h3>Delete {clubName}?</h3>
        <p>
          {isAccount
            ? ownedClubs.length
              ? `This permanently deletes your account and the ${ownedClubs.length === 1 ? "club" : "clubs"} you own (${ownedClubs.join(", ")}), with all their open play, games, players and members. There is no undo.`
              : "This permanently deletes your account. There is no undo."
            : "This permanently deletes the club with its open play, games, players and members. There is no undo."}
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
        {needsPassword && (
          <label>
            {isAccount ? "Account password" : "Club password"}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
            />
          </label>
        )}
        {error && <p className="clublogin-error" role="alert">{error}</p>}
        <div className="modalactions">
          <button type="button" className="outline" onClick={onCancel} disabled={loading}>Cancel</button>
          <button type="submit" className="danger" disabled={!ready}>
            {loading ? "Deleting…" : "Delete Forever"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
