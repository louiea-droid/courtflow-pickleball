import { useEffect, useState } from "react";
import { Camera, Check, Copy, KeyRound, Monitor, Moon, Pencil, Sun, Trash2, X } from "lucide-react";
import AvatarPicker from "../components/AvatarPicker";
import UserAvatar, { usePicture } from "../components/UserAvatar";
import ChangePasswordDialog from "../components/ChangePasswordDialog";
import PageTitle from "../components/PageTitle";
import Wave from "../components/Wave";
import { setGlobalTheme } from "../utils/theme";
import { NOTIFY_KINDS } from "../utils/notifications";
import { SettingsRow, Toggle } from "./Settings";

const THEMES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "Match device", Icon: Monitor },
];
const TABS = [["account", "Account"], ["appearance", "Appearance"], ["notifications", "Notifications"], ["privacy", "Privacy"], ["danger", "Danger zone"]];

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

// Your account's Settings (account menu > Settings, /settings), in tabs kept in the address (e.g. #notifications):
// your name, email, friend code and password; appearance; which bell alerts you get; privacy; deleting the account.
// A club's own settings are the Settings tab inside that club.
export default function Profile({ acct, onDelete, notify }) {
  const account = acct.account;
  const uid = acct.user?.uid;
  const picture = usePicture(uid);
  const [picking, setPicking] = useState(false);
  const name = account.name || account.clubName || "";
  const [tab, setTab] = useState(() => TABS.find(([id]) => `#${id}` === location.hash)?.[0] || "account");
  const pick = (id) => { setTab(id); history.replaceState(history.state, "", `#${id}`); };
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
      <PageTitle title="Settings" sub="Your own account. A club's settings are the Settings tab inside the club." />
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => pick(id)}>{label}</button>
        ))}
      </div>

      {tab === "account" && (
        <div className="account-groups">
          {/* Who you are: your name (rename here), sign-in email and friend code on the brand wave. */}
          <section className="profile-band" aria-label="Your profile">
            <div className="profile-avatar">
              <UserAvatar uid={uid} size={76} />
              <button type="button" className="profile-avatar-btn" aria-label="Change your picture" title="Change your picture" onClick={() => setPicking(true)}><Camera size={15} /></button>
            </div>
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
          {acct.hasPassword && (
            <div className="panel account-panel">
              <SettingsRow title="Password" body="Can't be looked up or displayed, only changed.">
                <button className="outline" onClick={() => setShowPassword(true)}><KeyRound size={14} /> Change password</button>
              </SettingsRow>
            </div>
          )}
        </div>
      )}

      {tab === "appearance" && (
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
          <p className="theme-note">Applies throughout CourtWave on this account. The sun / moon button at the top switches it too.</p>
        </div>
      )}

      {tab === "notifications" && (
        <div className="account-groups">
          <p className="settings-note">Choose what shows in the bell at the top. Saved on your account, so it applies on every device.</p>
          <div className="panel account-panel">
            {NOTIFY_KINDS.map(([kind, title, body]) => (
              <SettingsRow key={kind} title={title} body={body}>
                <Toggle label={title} checked={account.notify?.[kind] !== false}
                  onChange={(on) => acct.updateAccount({ notify: { ...account.notify, [kind]: on } }).catch(() => {})} />
              </SettingsRow>
            ))}
          </div>
        </div>
      )}

      {tab === "privacy" && (
        <div className="panel account-panel">
          <SettingsRow title="Let people find me by name" body="Off: only people who have your friend code can find you.">
            <Toggle label="Let people find me by name" checked={account.discoverable !== false}
              onChange={(discoverable) => acct.updateAccount({ discoverable }).catch(() => {})} />
          </SettingsRow>
        </div>
      )}

      {tab === "danger" && (
        <div className="panel account-panel account-danger">
          <SettingsRow title="Delete account" body="Permanently deletes your account and the clubs you own. Cannot be undone.">
            <button className="danger" onClick={onDelete}><Trash2 size={14} /> Delete account</button>
          </SettingsRow>
        </div>
      )}

      {picking && <AvatarPicker uid={uid} current={picture} notify={notify} onClose={() => setPicking(false)} />}
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
