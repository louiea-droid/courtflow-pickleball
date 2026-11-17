import { useEffect, useId, useRef, useState } from "react";
import UserAvatar from "./UserAvatar";
import { ChevronDown, LogOut, Settings as SettingsIcon, UserRound } from "lucide-react";

export default function AccountMenu({ name, email, uid, onSignOut, navigate }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId(); // two menus on the page (phone bar, sidebar foot)
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
      <div className="account-menu-panel" id={panelId} hidden={!open}>
        <div className="account-menu-identity">
          <b>{displayName}</b>
          {email && <span>{email}</span>}
        </div>
        <a className="account-menu-item" href="/settings" onClick={goToProfile}>
          <SettingsIcon size={16} /> Settings
        </a>
        <button className="account-menu-item" type="button" onClick={onSignOut}>
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </div>
  );
}
