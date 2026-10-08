import { useState } from "react";
import { Check, KeyRound, Pencil, Trash2, X } from "lucide-react";
import ChangePasswordDialog from "../components/ChangePasswordDialog";
import Select from "../components/Select";
import { SettingsRow } from "./Settings";

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match my device" },
];

// Your own profile: name, sign-in email, password, appearance, and deleting the account.
export default function Profile({ acct, onDelete }) {
  const account = acct.account;
  const name = account.name || account.clubName || "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [showPassword, setShowPassword] = useState(false);
  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) acct.updateAccount({ name: trimmed });
    setEditing(false);
  };

  return (
    <div className="account-groups">
      <div className="account-group">
        <div className="eyebrow">Profile</div>
        <div className="panel account-panel">
          <SettingsRow title="Name" body="Shown to the clubs you join and host.">
            {editing ? (
              <div className="account-edit">
                <input
                  value={draft} maxLength={60} autoFocus aria-label="Your name" onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                />
                <button className="icon" title="Save" onClick={save}><Check size={14} /></button>
                <button className="icon" title="Cancel" onClick={() => setEditing(false)}><X size={14} /></button>
              </div>
            ) : (
              <div className="account-edit">
                <b>{name}</b>
                <button className="icon" title="Rename" onClick={() => { setDraft(name); setEditing(true); }}><Pencil size={13} /></button>
              </div>
            )}
          </SettingsRow>
          <SettingsRow title="Email" body="What you sign in with.">
            <b>{account.email}</b>
          </SettingsRow>
          <SettingsRow hidden={!acct.hasPassword} title="Password" body="Can't be looked up or displayed, only changed.">
            <button className="outline" onClick={() => setShowPassword(true)}><KeyRound size={14} /> Change password</button>
          </SettingsRow>
          <SettingsRow title="Appearance" body="Light, dark, or follow your device. Clubs use their own colors inside the club.">
            <div className="account-select">
              <Select
                value={account.display?.theme || "light"}
                onChange={(theme) => acct.updateAccount({ display: { ...account.display, theme } })}
                options={THEMES}
              />
            </div>
          </SettingsRow>
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Danger zone</div>
        <div className="panel account-panel account-danger">
          <SettingsRow title="Delete account" body="Permanently deletes your account and the clubs you own. Cannot be undone.">
            <button className="danger" onClick={onDelete}><Trash2 size={14} /> Delete account</button>
          </SettingsRow>
        </div>
      </div>

      {showPassword && (
        <ChangePasswordDialog
          onCancel={() => setShowPassword(false)}
          onSubmit={async (current, next) => {
            const err = await acct.changePassword(current, next);
            if (!err) setShowPassword(false);
            return err;
          }}
        />
      )}
    </div>
  );
}
