import { useEffect, useId, useRef, useState } from "react";
import UserAvatar, { usePicture } from "./UserAvatar";
import AvatarPicker from "./AvatarPicker";
import { Bell, Camera, Check, ChevronDown, Copy, Lock, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { setGlobalTheme } from "../utils/theme";

const THEMES = [["light", "Light", Sun], ["dark", "Dark", Moon], ["system", "Device", Monitor]];
const LINKS = [["account", "Account settings", UserRound], ["notifications", "Notifications", Bell], ["privacy", "Privacy", Lock]];

// The account menu (sidebar foot on a wide screen, the phone's top bar). 2026-11-17, owner's pick: your picture (tap to
// change it), name, email, friend code with Copy, the theme as Light / Dark / Device, straight links to the Account,
// Notifications and Privacy tabs of Settings, and Sign out. Arrow keys move between the items; Esc closes and returns focus.
export default function AccountMenu({ name, email, uid, acct, onSignOut, navigate }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId(); // two menus on the page (phone bar, sidebar foot)
  const picture = usePicture(uid);
  const displayName = name || email?.split("@")[0] || "Account";
  const account = acct?.account;
  const theme = account?.display?.theme || "light";
  const code = account?.friendCode;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => { if (!menuRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = [...(panelRef.current?.querySelectorAll("button, a") || [])];
      if (!items.length) return;
      event.preventDefault();
      const at = items.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Settings keeps its tab in the hash, which routeOf does not read, so go to /settings and then set the hash.
  const goTo = (tab) => (event) => {
    event.preventDefault();
    setOpen(false);
    navigate("/settings");
    history.replaceState(history.state, "", `/settings#${tab}`);
    window.dispatchEvent(new HashChangeEvent("hashchange")); // Settings already open: switch its tab
  };
  const setTheme = (value) => {
    setGlobalTheme(value);
    acct.updateAccount({ display: { ...account.display, theme: value } });
  };
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the code stays visible to copy by hand */ }
  };

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        ref={triggerRef}
        className="account-menu-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        {uid ? <UserAvatar uid={uid} size={30} className="account-menu-pic" /> : <span className="account-menu-avatar"><UserRound size={17} /></span>}
        <span className="account-menu-trigger-copy">
          <b>{displayName}</b>
          <small>Account</small>
        </span>
        <ChevronDown className="account-menu-chevron" size={15} />
      </button>
      <div className="account-menu-panel" id={panelId} ref={panelRef} hidden={!open}>
        <div className="account-menu-identity">
          {uid && (
            <button type="button" className="account-menu-photo" aria-label="Change your picture" title="Change your picture" onClick={() => { setOpen(false); setPicking(true); }}>
              <UserAvatar uid={uid} size={44} />
              <span className="account-menu-cam" aria-hidden="true"><Camera size={12} /></span>
            </button>
          )}
          <span className="account-menu-who">
            <b>{displayName}</b>
            {email && <span>{email}</span>}
          </span>
        </div>
        {code && (
          <div className="account-menu-code">
            <span>Friend code <b>{code}</b></span>
            <button type="button" onClick={copyCode} aria-label={copied ? "Friend code copied" : `Copy friend code ${code}`}>
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          </div>
        )}
        {account && (
          <div className="account-menu-theme" role="radiogroup" aria-label="Theme">
            {THEMES.map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => setTheme(value)}>
                <Icon size={14} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        )}
        <div className="account-menu-links">
          {LINKS.map(([tab, label, Icon]) => (
            <a key={tab} className="account-menu-item" href={`/settings#${tab}`} onClick={goTo(tab)}>
              <Icon size={16} /> {label}
            </a>
          ))}
        </div>
        <button className="account-menu-item account-menu-out" type="button" onClick={onSignOut}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
      {picking && <AvatarPicker uid={uid} current={picture} notify={() => {}} onClose={() => setPicking(false)} />}
    </div>
  );
}
