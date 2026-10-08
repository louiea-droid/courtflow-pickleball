import { useState } from "react";
import { Check, Copy, KeyRound, Pencil, Trash2, X } from "lucide-react";
import ChangePasswordDialog from "../components/ChangePasswordDialog";
import PageTitle from "../components/PageTitle";
import Select from "../components/Select";
import { SettingsRow } from "./Settings";

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match my device" },
];

// The friend code with a Copy button (it is how people who aren't in the name directory find you).
function FriendCode({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* the code is on screen to copy by hand */ }
  };
  return (
    <div className="friend-code">
      <code aria-label="Your friend code">{code}</code>
      <button className="outline" onClick={copy}><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

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
    <div className="page-narrow">
      <PageTitle title="Profile" sub="Your name, sign-in and appearance." />
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
          <SettingsRow title="Friend code" body="Share it so friends can find you, even if you are hidden from the name search.">
            {account.friendCode ? <FriendCode code={account.friendCode} /> : <span className="hub-empty">Making your code…</span>}
          </SettingsRow>
          <SettingsRow title="Let people find me by name" body="Off: only people who have your friend code can find you.">
            <label className="switch">
              <input
                type="checkbox" role="switch" aria-label="Let people find me by name"
                checked={account.discoverable !== false} onChange={(e) => acct.updateAccount({ discoverable: e.target.checked })}
              />
            </label>
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
    </div>
  );
}
