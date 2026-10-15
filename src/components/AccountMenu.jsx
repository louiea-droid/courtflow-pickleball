import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleHelp, LogOut, Settings as SettingsIcon, UserRound } from "lucide-react";

export default function AccountMenu({ name, email, onSignOut, navigate, settingsPath = null }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const displayName = name || email?.split("@")[0] || "Account";

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const goToProfile = (event) => {
    event.preventDefault();
    setOpen(false);
    navigate("/settings");
  };

  const goToHelp = (event) => {
    event.preventDefault();
    setOpen(false);
    navigate("/help");
  };

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        ref={triggerRef}
        className="account-menu-trigger"
        type="button"
        aria-expanded={open}
        aria-controls="account-menu-panel"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className="account-menu-avatar"><UserRound size={17} /></span>
        <span className="account-menu-trigger-copy">
          <b>{displayName}</b>
          <small>Account</small>
        </span>
        <ChevronDown className="account-menu-chevron" size={15} />
      </button>
      <div className="account-menu-panel" id="account-menu-panel" hidden={!open}>
        <div className="account-menu-identity">
          <b>{displayName}</b>
          {email && <span>{email}</span>}
        </div>
        <a className="account-menu-item" href="/settings" onClick={goToProfile}>
          <UserRound size={16} /> Profile
        </a>
        {settingsPath && (
          <a className="account-menu-item" href={settingsPath} onClick={(e) => { e.preventDefault(); setOpen(false); navigate(settingsPath); }}>
            <SettingsIcon size={16} /> Settings
          </a>
        )}
        <a className="account-menu-item" href="/help" onClick={goToHelp}>
          <CircleHelp size={16} /> Help
        </a>
        <button className="account-menu-item" type="button" onClick={onSignOut}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
