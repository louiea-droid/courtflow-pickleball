import { useState } from "react";
import { createPortal } from "react-dom";

export default function DeleteAccountDialog({ clubName, loading, onCancel, onConfirm }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === clubName;

  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !loading && onCancel()}>
      <div className="modal confirm-modal">
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
        <div className="modalactions">
          <button className="outline" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="danger" disabled={!matches || loading} onClick={onConfirm}>
            {loading ? "Deleting…" : "Delete Forever"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
