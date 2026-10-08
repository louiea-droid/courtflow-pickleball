import { useState } from "react";
import { LogOut, Link2, RefreshCw, Share2 } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import PageTitle from "../components/PageTitle";
import ShareModal from "../components/ShareModal";
import { useInvite, useMembers } from "../hooks/useMembership";
import { formatDate } from "../utils/format";
import { ROLE_LABEL, canChangeRole, canRemove, inviteUrl } from "../utils/clubs";

// One invite link: share it, reset it, or make it the first time.
function LinkBlock({ title, help, code, ready, busy, role, onShare, onReset, onCreate }) {
  const noun = role === "manager" ? "manager link" : "invite link";
  return (
    <div className="panel members-block">
      <h2 className="club-section">{title}</h2>
      <p className="members-help">{help}</p>
      {!ready ? (
        <p className="hub-empty">Loading…</p>
      ) : code ? (
        <div className="member-actions">
          <button className="primary" onClick={onShare}><Share2 size={15} /> Share {noun}</button>
          <button className="outline" disabled={busy} onClick={onReset}><RefreshCw size={15} /> Reset link</button>
        </div>
      ) : (
        <button className="primary" disabled={busy} onClick={onCreate}><Link2 size={15} /> Create {noun}</button>
      )}
    </div>
  );
}

// Everyone in the club sees who is in it. Plain members can leave; managers also review join requests,
// manage the invite link and remove plain members. Only the owner names managers (by hand or with the
// manager link) and can remove a manager.
export default function ClubMembers({ clubId, club, uid, canManage, isOwner, requests, actions, navigate, notify }) {
  const { members, ready } = useMembers(clubId);
  const { code, ready: inviteReady } = useInvite(canManage ? clubId : null);
  const { code: managerCode, ready: managerReady } = useInvite(isOwner ? clubId : null, "managerInvite");
  // { kind: "remove" | "demote", member } | { kind: "leave" } | { kind: "reset", role }
  const [confirm, setConfirm] = useState(null);
  const [showShare, setShowShare] = useState(null); // null | "member" | "manager"
  const myRole = isOwner ? "owner" : canManage ? "manager" : "member";
  const [busy, setBusy] = useState(false);

  // One action at a time; a failure says so instead of failing silently.
  const act = async (fn, okMessage, failMessage) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (okMessage) notify(okMessage);
    } catch (err) {
      notify(typeof failMessage === "function" ? failMessage(err) : failMessage, 4000);
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
                <button className="primary" disabled={busy} onClick={() => act(() => actions.approve(r), `${r.name} joined the club.`, (err) => (err.code === "withdrawn" ? "They withdrew the request." : "Couldn't approve. Check your connection and try again."))}>Approve</button>
                <button className="outline" disabled={busy} onClick={() => act(() => actions.decline(r), `Declined ${r.name}.`, "Couldn't decline. Try again.")}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <LinkBlock
          title="Invite link" role="member" code={code} ready={inviteReady} busy={busy}
          help="Anyone signed in with this link joins right away, even a private club. Reset it to stop old links."
          onShare={() => setShowShare("member")} onReset={() => setConfirm({ kind: "reset", role: "member" })}
          onCreate={() => act(() => actions.saveInvite("member"), "Invite link created.", "Couldn't create the link. Try again.")}
        />
      )}
      {isOwner && (
        <LinkBlock
          title="Manager link" role="manager" code={managerCode} ready={managerReady} busy={busy}
          help="Anyone signed in with this link joins as a manager: they run open play and games and approve requests. Only you can see it. Share it carefully, and reset it to stop old links."
          onShare={() => setShowShare("manager")} onReset={() => setConfirm({ kind: "reset", role: "manager" })}
          onCreate={() => act(() => actions.saveInvite("manager"), "Manager link created.", "Couldn't create the link. Try again.")}
        />
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
              {m.id !== uid && canChangeRole(myRole, m.role) && (m.role === "member" ? (
                <button className="outline" disabled={busy} onClick={() => act(() => actions.setRole(m, "manager"), `${m.name} is now a manager.`, "Couldn't change the role. Check your connection and try again.")}>Make manager</button>
              ) : (
                <button className="outline" disabled={busy} onClick={() => setConfirm({ kind: "demote", member: m })}>Remove manager</button>
              ))}
              {m.id !== uid && canRemove(myRole, m.role) && (
                <button className="outline" disabled={busy} onClick={() => setConfirm({ kind: "remove", member: m })}>Remove</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showShare && (showShare === "manager" ? managerCode : code) && (
        <ShareModal
          url={inviteUrl(window.location.origin, clubId, showShare === "manager" ? managerCode : code, showShare)} close={() => setShowShare(null)}
          title={showShare === "manager" ? "Share manager link" : "Share invite link"} label={showShare === "manager" ? "MANAGER LINK" : "INVITE LINK"} openLabel="Open link" qr
          hint={showShare === "manager"
            ? `Anyone signed in with this link joins ${club.name} as a manager. Only send it to people you trust. Reset the link on this page to stop old ones.`
            : `Anyone signed in with this link joins ${club.name} right away. Reset the link on this page to stop old ones.`}
        />
      )}
      {confirm?.kind === "demote" && (
        <ConfirmDialog
          title={`Remove ${confirm.member.name} as manager?`} message="They stay in the club as a member and lose access to open play, games and settings." confirmLabel="Remove manager"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const m = confirm.member;
            setConfirm(null);
            act(() => actions.setRole(m, "member"), `${m.name} is a member again.`, "Couldn't change the role. Check your connection and try again.");
          }}
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
            act(async () => { await actions.leave(); navigate("/"); }, null, "Couldn't leave. Check your connection and try again.");
          }}
        />
      )}
      {confirm?.kind === "reset" && (
        <ConfirmDialog
          title={confirm.role === "manager" ? "Reset the manager link?" : "Reset the invite link?"} message="Old links stop working. Share the new link with the people you still want to invite." confirmLabel="Reset link"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const role = confirm.role;
            setConfirm(null);
            act(() => actions.saveInvite(role), "New link created. Old links no longer work.", "Couldn't reset the link. Try again.");
          }}
        />
      )}
    </>
  );
}
