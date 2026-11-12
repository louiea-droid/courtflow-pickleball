import { useRef, useState } from "react";
import { CalendarDays, ChevronDown, Link2, RefreshCw, Share2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import ShareModal from "./ShareModal";
import { useInvite } from "../hooks/useMembership";
import { inviteUrl } from "../utils/clubs";

// The header's Share menu: the booking page (public clubs) and, for managers, the members invite link.
export default function ClubShareMenu({ clubId, clubName, isPublic, canManage, actions, notify, onShareBooking }) {
  const { code, ready } = useInvite(canManage ? clubId : null);
  const [busy, setBusy] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [resetInvite, setResetInvite] = useState(false);
  const menuRef = useRef(null);
  const pick = (fn) => () => { if (menuRef.current) menuRef.current.open = false; fn(); };

  const saveInvite = async (success, failure) => {
    if (busy) return;
    setBusy(true);
    try { await actions.saveInvite("member"); notify(success); } catch { notify(failure, 4000); } finally { setBusy(false); }
  };

  if (!isPublic && !canManage) return null;
  return (
    <>
      <details className="club-tools-menu club-share-menu" ref={menuRef}>
        <summary><Share2 size={15} /> Share <ChevronDown size={14} /></summary>
        <div className="club-tools-panel" role="group" aria-label="Share">
          {isPublic && (
            <button className="club-tools-item" onClick={pick(onShareBooking)}>
              <CalendarDays size={15} /><span>Share booking page<small>Link and QR code for open play</small></span>
            </button>
          )}
          {canManage && !ready && <span className="club-tools-item" aria-live="polite">Loading invite link…</span>}
          {canManage && ready && code && (
            <>
              <button className="club-tools-item" onClick={pick(() => setShowInvite(true))}>
                <Link2 size={15} /><span>Share invite link<small>Joins the club right away</small></span>
              </button>
              <span className="club-tools-divider" role="separator" />
              <button className="club-tools-item muted" disabled={busy} onClick={pick(() => setResetInvite(true))}>
                <RefreshCw size={15} /> Reset invite link
              </button>
            </>
          )}
          {canManage && ready && !code && (
            <button className="club-tools-item" disabled={busy}
              onClick={pick(() => saveInvite("Invite link created.", "Couldn't create the invite link. Try again."))}>
              <Link2 size={15} /> Create invite link
            </button>
          )}
        </div>
      </details>

      {showInvite && code && (
        <ShareModal
          url={inviteUrl(window.location.origin, clubId, code)} close={() => setShowInvite(false)}
          title="Share invite link" label="INVITE LINK" openLabel="Open link" qr
          hint={`Anyone signed in with this link joins ${clubName} right away.`}
        />
      )}
      {resetInvite && (
        <ConfirmDialog
          title="Reset the invite link?"
          message="Old links stop working. Share the new link with the people you still want to invite."
          confirmLabel="Reset link" onCancel={() => setResetInvite(false)}
          onConfirm={() => {
            setResetInvite(false);
            saveInvite("New link created. Old links no longer work.", "Couldn't reset the link. Try again.");
          }}
        />
      )}
    </>
  );
}
