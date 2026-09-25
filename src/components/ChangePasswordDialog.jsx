import { useState } from "react";
import { createPortal } from "react-dom";

export default function ChangePasswordDialog({ onCancel, onSubmit }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    if (next.length < 6) return setError("New password must be at least 6 characters.");
    if (next !== confirm) return setError("New passwords don't match.");
    setError("");
    setSaving(true);
    const err = await onSubmit(current, next);
    setSaving(false);
    if (err) setError(err);
  }

  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && onCancel()}>
      <form className="modal confirm-modal" onSubmit={submit}>
        <h3>Change Password</h3>
        <p>
          There's no way to look up or display the current password — Firebase only ever stores a
          one-way hash of it, not the password itself. Enter it once here to set a new one.
        </p>
        <label>
          Current password
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoFocus
            autoComplete="current-password"
            required
            disabled={saving}
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
            disabled={saving}
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            disabled={saving}
          />
        </label>
        {error && <p className="clublogin-error">{error}</p>}
        <div className="modalactions">
          <button type="button" className="outline" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="primary" disabled={saving}>{saving ? "Saving…" : "Change Password"}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}
