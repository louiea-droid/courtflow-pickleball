import { useState } from "react";
import { LogOut, Link2, RefreshCw, Share2 } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import PageTitle from "../components/PageTitle";
import ShareModal from "../components/ShareModal";
import { useInvite, useMembers } from "../hooks/useMembership";
import { formatDate } from "../utils/format";
import { ROLE_LABEL, inviteUrl } from "../utils/clubs";

// Everyone in the club sees who is in it. Plain members can leave; managers also review join requests,
// manage the invite link and remove plain members.
export default function ClubMembers({ clubId, club, uid, canManage, isOwner, requests, actions, navigate, notify }) {
  const { members, ready } = useMembers(clubId);
  const { code, ready: inviteReady } = useInvite(canManage ? clubId : null);
  const [confirm, setConfirm] = useState(null); // { kind: "remove", member } | { kind: "leave" } | { kind: "reset" }
  const [showShare, setShowShare] = useState(false);
  const [busy, setBusy] = useState(false);

  // One action at a time; a failure says so instead of failing silently.
  const act = async (fn, okMessage, failMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (okMessage) notify(okMessage);
    } catch {
      notify(failMessage, 4000);
    }
    setBusy(false);
  };

  return (
    <>
      <PageTitle
        title="Members"
        sub={isOwner ? "You own this club. To step away, delete it in Settings." : ready ? `${members.length} in this club` : undefined}
      >
        {!isOwner && <button className="outline" onClick={() => setConfirm({ kind: "leave" })}><LogOut size={15} /> Leave club</button>}
      </PageTitle>

      {canManage && requests.length > 0 && (
        <div className="panel members-block">
          <h2 className="club-section">Join requests <span className="count-badge">{requests.length}</span></h2>
          {requests.map((r) => (
            <div className="member-row" key={r.id}>
              <div className="member-main">
                <b>{r.name}</b>
                {r.message && <small>{r.message}</small>}
              </div>
              <div className="member-actions">
                <button className="primary" disabled={busy} onClick={() => act(() => actions.approve(r), `${r.name} joined the club.`, "Couldn't approve. Check your connection and try again.")}>Approve</button>
                <button className="outline" disabled={busy} onClick={() => act(() => actions.decline(r), `Declined ${r.name}.`, "Couldn't decline. Try again.")}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <div className="panel members-block">
          <h2 className="club-section">Invite link</h2>
          <p className="members-help">Anyone signed in with this link joins right away, even a private club. Reset it to stop old links.</p>
          {!inviteReady ? (
            <p className="hub-empty">Loading…</p>
          ) : code ? (
            <div className="member-actions">
              <button className="primary" onClick={() => setShowShare(true)}><Share2 size={15} /> Share invite link</button>
              <button className="outline" disabled={busy} onClick={() => setConfirm({ kind: "reset" })}><RefreshCw size={15} /> Reset link</button>
            </div>
          ) : (
            <button className="primary" disabled={busy} onClick={() => act(actions.saveInvite, "Invite link created.", "Couldn't create the link. Try again.")}><Link2 size={15} /> Create invite link</button>
          )}
        </div>
      )}

      <div className="panel members-block">
        <h2 className="club-section">Everyone</h2>
        {!ready ? (
          <p className="hub-empty">Loading members…</p>
        ) : members.map((m) => (
          <div className="member-row" key={m.id}>
            <div className="member-main">
              <b>{m.name}{m.id === uid ? " (you)" : ""}</b>
              {m.joinedAt && <small>Joined {formatDate(m.joinedAt)}</small>}
            </div>
            <div className="member-actions">
              <span className="pill">{ROLE_LABEL[m.role] || ROLE_LABEL.member}</span>
              {canManage && m.role === "member" && m.id !== uid && (
                <button className="outline" disabled={busy} onClick={() => setConfirm({ kind: "remove", member: m })}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showShare && code && (
        <ShareModal
          url={inviteUrl(window.location.origin, clubId, code)} close={() => setShowShare(false)}
          title="Share invite link" label="INVITE LINK" openLabel="Open link" qr
          hint={`Anyone signed in with this link joins ${club.name} right away. Reset the link on this page to stop old ones.`}
        />
      )}
      {confirm?.kind === "remove" && (
        <ConfirmDialog
          title={`Remove ${confirm.member.name}?`} message="They lose access to this club. They can ask to join again." confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const m = confirm.member;
            setConfirm(null);
            act(() => actions.removeMember(m), `${m.name} was removed.`, "Couldn't remove them. Check your connection and try again.");
          }}
        />
      )}
      {confirm?.kind === "leave" && (
        <ConfirmDialog
          title={`Leave ${club.name}?`} message="You lose access to this club. You can ask to join again, or use an invite link." confirmLabel="Leave club"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            act(async () => { await actions.leave(); navigate("/"); }, `You left ${club.name}.`, "Couldn't leave. Check your connection and try again.");
          }}
        />
      )}
      {confirm?.kind === "reset" && (
        <ConfirmDialog
          title="Reset the invite link?" message="Old links stop working. Share the new link with the people you still want to invite." confirmLabel="Reset link"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            act(actions.saveInvite, "New invite link created. Old links no longer work.", "Couldn't reset the link. Try again.");
          }}
        />
      )}
    </>
  );
}
