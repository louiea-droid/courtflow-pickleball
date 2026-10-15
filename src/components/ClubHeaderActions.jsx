import { useRef, useState } from "react";
import { CalendarPlus, ChevronDown, Link2, Play, RefreshCw, Share2, Users, Wrench } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import ShareModal from "./ShareModal";
import { useInvite } from "../hooks/useMembership";
import { clubPath, inviteUrl } from "../utils/clubs";

export default function ClubHeaderActions({
  clubId, canManage, actions, navigate, notify,
  onStartNew, onPlayNow, onShareBookingPage,
}) {
  const { code, ready } = useInvite(canManage ? clubId : null);
  const [busy, setBusy] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [resetInvite, setResetInvite] = useState(false);
  const menuRef = useRef(null);

  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  const act = async (fn, success, failure) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (success) notify(success);
    } catch {
      notify(failure, 4000);
    } finally {
      setBusy(false);
    }
  };

  const inviteAction = () => {
    if (!ready) return null;
    const label = "Invite link";
    return (
      <span className="club-tools-link-group" key="member-invite">
        {code ? (
          <>
            <button className="club-tools-item" onClick={() => { closeMenu(); setShowShare(true); }}><Share2 size={15} /> Share {label}</button>
            <button className="club-tools-item" disabled={busy} onClick={() => { closeMenu(); setResetInvite(true); }}><RefreshCw size={15} /> Reset {label.toLowerCase()}</button>
          </>
        ) : (
          <button className="club-tools-item" disabled={busy} onClick={() => {
            closeMenu();
            act(
              () => actions.saveInvite("member"),
              "Invite link created.",
              "Couldn't create the invite link. Try again.",
            );
          }}><Link2 size={15} /> Create {label.toLowerCase()}</button>
        )}
      </span>
    );
  };

  const hasTools = canManage;

  return (
    <>
      {hasTools && (
        <details className="club-tools-menu" ref={menuRef}>
          <summary><Wrench size={15} /> Club tools <ChevronDown size={14} /></summary>
          <div className="club-tools-panel" role="group" aria-label="Club tools">
            {canManage && (
              <>
                <button className="club-tools-item" onClick={() => { closeMenu(); onStartNew(); }}><CalendarPlus size={15} /> Start new</button>
                <button className="club-tools-item" onClick={() => { closeMenu(); onPlayNow(); }}><Play size={15} /> Play now</button>
                <button className="club-tools-item" onClick={() => { closeMenu(); onShareBookingPage(); }}><Share2 size={15} /> Share booking page</button>
                <span className="club-tools-divider" role="separator" />
                <a className="club-tools-item" href={clubPath(clubId, "/members")} onClick={(e) => { e.preventDefault(); closeMenu(); navigate(clubPath(clubId, "/members")); }}>
                  <Users size={15} /> Manage members
                </a>
              </>
            )}
            {canManage && (
              ready ? inviteAction() : <span className="club-tools-item" aria-live="polite">Loading invite link…</span>
            )}
          </div>
        </details>
      )}

      {showShare && code && (
        <ShareModal
          url={inviteUrl(window.location.origin, clubId, code)} close={() => setShowShare(false)}
          title="Share invite link"
          label="INVITE LINK" openLabel="Open link" qr
          hint={`Anyone signed in with this link joins ${club.name} right away.`}
        />
      )}
      {resetInvite && (
        <ConfirmDialog
          title="Reset the invite link?"
          message="Old links stop working. Share the new link with the people you still want to invite."
          confirmLabel="Reset link" onCancel={() => setResetInvite(false)}
          onConfirm={() => {
            setResetInvite(false);
            act(() => actions.saveInvite("member"), "New link created. Old links no longer work.", "Couldn't reset the link. Try again.");
          }}
        />
      )}
    </>
  );
}
