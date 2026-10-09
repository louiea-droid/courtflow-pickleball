import { useState } from "react";
import { LogOut, MessageSquare } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import PageTitle from "../components/PageTitle";
import { useMembers } from "../hooks/useMembership";
import { formatDate } from "../utils/format";
import { ROLE_LABEL, canChangeRole, canRemove } from "../utils/clubs";

// Everyone in the club sees who is in it. Plain members can leave; managers also review join requests,
// manage the invite link and remove plain members. `chat` = { ready, exists } for the club's group chat: a manager
// turns it on, then everyone opens it from here. Only the owner names managers (by hand or with the
// manager link) and can remove a manager.
export default function ClubMembers({ clubId, club, uid, canManage, isOwner, requests, actions, chatActions, navigate, notify }) {
  const { members, ready } = useMembers(clubId);
  // { kind: "remove" | "demote", member } | { kind: "leave" }
  const [confirm, setConfirm] = useState(null);
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
              {m.id !== uid && (
                <button className="outline" disabled={busy} onClick={() => act(async () => navigate(`/inbox/${await chatActions.startDm(m.id, { me: members.find((x) => x.id === uid)?.name, other: m.name }, clubId)}`), null, "Couldn't open the conversation. Try again.")}><MessageSquare size={15} /> Message</button>
              )}
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
    </>
  );
}
