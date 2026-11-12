import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Monitor, Moon, Pencil, Sun, Trash2, X } from "lucide-react";
import ChangePasswordDialog from "../components/ChangePasswordDialog";
import PageTitle from "../components/PageTitle";
import Wave from "../components/Wave";
import { setGlobalTheme } from "../utils/theme";
import { SettingsRow } from "./Settings";

const THEMES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Match device", Icon: Monitor },
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
    <div className="profile-code">
      <span>Friend code</span>
      <code aria-label="Your friend code">{code}</code>
      <button className="home-btn lime" onClick={copy}><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

// Your own profile: name, sign-in email, password, appearance, and deleting the account.
export default function Profile({ acct, onDelete }) {
  const account = acct.account;
  const name = account.name || account.clubName || "";
  const [theme, setTheme] = useState(account.display?.theme || "light");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [showPassword, setShowPassword] = useState(false);
  useEffect(() => setTheme(account.display?.theme || "light"), [account.display?.theme]);
  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) acct.updateAccount({ name: trimmed });
    setEditing(false);
  };

  return (
    <div className="page-narrow profile-page">
      <PageTitle title="Profile" hidden />
      {/* Who you are: your name (rename here), sign-in email and friend code on the brand wave. */}
      <section className="profile-band" aria-label="Your profile">
        {editing ? (
          <div className="profile-name-edit">
            <input
              value={draft} maxLength={60} autoFocus aria-label="Your name" onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            />
            <button className="glass-btn" aria-label="Save name" onClick={save}><Check size={16} /></button>
            <button className="glass-btn" aria-label="Cancel" onClick={() => setEditing(false)}><X size={16} /></button>
          </div>
        ) : (
          <div className="profile-name">
            <h2>{name}</h2>
            <button className="glass-btn" aria-label="Change your name" onClick={() => { setDraft(name); setEditing(true); }}><Pencil size={15} /></button>
          </div>
        )}
        <p className="profile-sub">{account.email}</p>
        {account.friendCode ? <FriendCode code={account.friendCode} /> : <p className="profile-sub">Making your friend code…</p>}
        <Wave />
      </section>

      <div className="account-groups">
      <div className="account-group">
        <div className="eyebrow">Privacy and sign-in</div>
        <div className="panel account-panel">
          <SettingsRow title="Let people find me by name" body="Off: only people who have your friend code can find you.">
            <label className="switch">
              <input
                type="checkbox" role="switch" aria-label="Let people find me by name"
                checked={account.discoverable !== false} onChange={(e) => acct.updateAccount({ discoverable: e.target.checked }).catch(() => {})}
              />
            </label>
          </SettingsRow>
          <SettingsRow hidden={!acct.hasPassword} title="Password" body="Can't be looked up or displayed, only changed.">
            <button className="outline" onClick={() => setShowPassword(true)}><KeyRound size={14} /> Change password</button>
          </SettingsRow>
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Appearance</div>
        <div className="panel account-panel">
          <div className="theme-picker" role="radiogroup" aria-label="Appearance">
            {THEMES.map(({ value, label, Icon }) => (
              <button
                key={value} type="button" role="radio" aria-checked={theme === value}
                className={`theme-choice theme-${value}`}
                onClick={() => {
                  setTheme(value);
                  setGlobalTheme(value);
                  acct.updateAccount({ display: { ...account.display, theme: value } });
                }}
              >
                <span className="theme-swatch" aria-hidden="true"><i /><i /></span>
                <span><Icon size={15} aria-hidden="true" /> {label}</span>
              </button>
            ))}
          </div>
          <p className="theme-note">Applies throughout CourtWave on this account.</p>
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
