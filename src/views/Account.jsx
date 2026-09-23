import { useState } from "react";
import { Pencil, Plus, LogOut, Trash2, Check, X } from "lucide-react";

function AccountRow({ title, body, children }) {
  return (
    <div className="account-row">
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {children}
    </div>
  );
}

export default function Account({ session, onRenameClub, onNewSession, onSwitchClub, onDeleteAccount }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(session.location);

  const startEdit = () => { setName(session.location); setEditing(true); };
  const save = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== session.location) onRenameClub(trimmed);
    setEditing(false);
  };

  return (
    <div className="panel account-panel">
      <AccountRow title="Club name" body="Shown throughout the app and on your public Live Board link.">
        {editing ? (
          <div className="account-edit">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
            <button className="icon" title="Save" onClick={save}><Check size={14} /></button>
            <button className="icon" title="Cancel" onClick={() => setEditing(false)}><X size={14} /></button>
          </div>
        ) : (
          <div className="account-edit">
            <b>{session.location}</b>
            <button className="icon" title="Rename" onClick={startEdit}><Pencil size={13} /></button>
          </div>
        )}
      </AccountRow>

      <AccountRow title="New Session" body="Clears the roster, courts, and match log and starts fresh. Stats are archived first.">
        <button className="outline" onClick={onNewSession}><Plus size={14} /> Start New Session</button>
      </AccountRow>

      <AccountRow title="Switch Club" body="Signs you out. Log back in with the password to pick up right where you left off.">
        <button className="outline" onClick={onSwitchClub}><LogOut size={14} /> Switch Club</button>
      </AccountRow>

      <AccountRow title="Delete Account" body="Permanently erases this club and everything in it. Cannot be undone.">
        <button className="danger" onClick={onDeleteAccount}><Trash2 size={14} /> Delete Account</button>
      </AccountRow>
    </div>
  );
}
