import { useState } from "react";
import { Copy, Link2, LogOut, MessageSquare, RefreshCw, Search } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import PageTitle from "../components/PageTitle";
import RowMenu from "../components/RowMenu";
import UserAvatar from "../components/UserAvatar";
import { useInvite, useMembers } from "../hooks/useMembership";
import { formatDate } from "../utils/format";
import { ROLE_LABEL, SEARCH_FROM, canChangeRole, canRemove, groupMembers, inviteUrl, memberCounts } from "../utils/clubs";

// The managers' invite link as a dark strip: the link, Copy and New link (the same actions are in the header's Share).
function InviteStrip({ clubId, actions, notify, busy, act }) {
  const { code, ready, error } = useInvite(clubId);
  const [reset, setReset] = useState(false);
  if (!ready) return null;
  const url = code ? inviteUrl(window.location.origin, clubId, code) : "";
  // Promise.resolve: clipboard is missing (throws) outside a secure context.
  const copy = () => Promise.resolve().then(() => navigator.clipboard.writeText(url)).then(() => notify("Link copied."), () => notify("Couldn't copy. Select the link and copy it.", 4000));
  return (
    <section className="invite-strip" aria-label="Invite link">
      <span className="invite-strip-label"><Link2 size={15} /> Invite link</span>
      {error ? (
        <span className="invite-strip-url">Couldn&apos;t load the invite link. Reload to try again.</span>
      ) : code ? (
        <>
          <code className="invite-strip-url">{url.replace(/^https?:\/\//, "")}</code>
          <button className="home-btn lime" onClick={copy}><Copy size={15} /> Copy</button>
          <button className="home-btn ghost" disabled={busy} onClick={() => setReset(true)}><RefreshCw size={15} /> New link</button>
        </>
      ) : (
        <button className="home-btn lime" disabled={busy} onClick={() => act(() => actions.saveInvite("member"), "Invite link created.", "Couldn't create the invite link. Try again.")}>
          <Link2 size={15} /> Create invite link
        </button>
      )}
      {reset && (
        <ConfirmDialog
          title="Reset the invite link?"
          message="Old links stop working. Share the new link with the people you still want to invite."
          confirmLabel="Reset link" onCancel={() => setReset(false)}
          onConfirm={() => { setReset(false); act(() => actions.saveInvite("member"), "New link created. Old links no longer work.", "Couldn't reset the link. Try again."); }}
        />
      )}
    </section>
  );
}

// Everyone in the club sees who is in it, grouped (owner and managers, then members) with a search once the club is
// bigger. Managers also review join requests and the invite link. Message stays on each row; role changes and removal
// live in a "⋯" menu. Only the owner names managers and removes a manager.
export default function ClubMembers({ clubId, club, uid, canManage, isOwner, requests, actions, chatActions, navigate, notify }) {
  const { members, ready } = useMembers(clubId);
  const [query, setQuery] = useState("");
  // { kind: "remove" | "demote", member } | { kind: "leave" }
  const [confirm, setConfirm] = useState(null);
  const myRole = isOwner ? "owner" : canManage ? "manager" : "member";
  const [busy, setBusy] = useState(false);
  const counts = memberCounts(members);
  const { leads, others } = groupMembers(members, query);
  const me = members.find((x) => x.id === uid);

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

  const menuFor = (m) => [
    ...(canChangeRole(myRole, m.role) ? [m.role === "member"
      ? { label: "Make manager", onSelect: () => act(() => actions.setRole(m, "manager"), `${m.name} is now a manager.`, "Couldn't change the role. Check your connection and try again.") }
      : { label: "Remove manager", onSelect: () => setConfirm({ kind: "demote", member: m }) }] : []),
    ...(canRemove(myRole, m.role) ? [{ label: "Remove from club", danger: true, onSelect: () => setConfirm({ kind: "remove", member: m }) }] : []),
  ];

  const row = (m) => {
    const items = m.id === uid ? [] : menuFor(m);
    return (
      <div className="member-row" key={m.id}>
        <UserAvatar uid={m.id} />
        <div className="member-main">
          <b>{m.name}{m.id === uid ? " (you)" : ""}</b>
          {m.joinedAt && <small>Joined {formatDate(m.joinedAt)}</small>}
        </div>
        <div className="member-actions">
          <span className={`club-role${m.role === "member" ? " soft" : ""}`}>{ROLE_LABEL[m.role] || ROLE_LABEL.member}</span>
          {m.id !== uid && (
            <button className="outline member-message" disabled={busy} aria-label={`Message ${m.name}`}
              onClick={() => act(async () => navigate(`/inbox/${await chatActions.startDm(m.id, { me: me?.name, other: m.name }, clubId)}`), null, "Couldn't open the conversation. Try again.")}>
              <MessageSquare size={15} /> <span>Message</span>
            </button>
          )}
          {items.length > 0 && <RowMenu label={`More for ${m.name}`} items={items} />}
        </div>
      </div>
    );
  };

  return (
    <div className="members-page">
      <PageTitle title="Members" sub={isOwner ? "You own this club. To step away, delete it in Settings." : undefined}>
        {!isOwner && <button className="outline" onClick={() => setConfirm({ kind: "leave" })}><LogOut size={15} /> Leave club</button>}
      </PageTitle>

      {ready && (
        <div className="member-counts">
          <span><b>{counts.members}</b> member{counts.members === 1 ? "" : "s"}</span>
          <span><b>{counts.managers}</b> manager{counts.managers === 1 ? "" : "s"}</span>
          {canManage && <span className={requests.length ? "waiting" : ""}><b>{requests.length}</b> waiting to join</span>}
        </div>
      )}

      {canManage && requests.length > 0 && (
        <div className="panel members-block friend-requests">
          <h2 className="club-section">Waiting for you <span className="count-badge">{requests.length}</span></h2>
          {requests.map((r) => (
            <div className="member-row" key={r.id}>
              <div className="member-main">
                <b>{r.name}</b>
                <small>{r.message ? `“${r.message}”` : r.createdAt ? `Asked ${formatDate(r.createdAt)}` : "Asked to join"}</small>
              </div>
              <div className="member-actions">
                <button className="primary" disabled={busy} onClick={() => act(() => actions.approve(r), `${r.name} joined the club.`, (err) => (err.code === "withdrawn" ? "They withdrew the request." : "Couldn't approve. Check your connection and try again."))}>Approve</button>
                <button className="outline" disabled={busy} onClick={() => act(() => actions.decline(r), `Declined ${r.name}.`, "Couldn't decline. Try again.")}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && <InviteStrip clubId={clubId} actions={actions} notify={notify} busy={busy} act={act} />}

      <div className="panel members-block">
        <h2 className="club-section">Everyone {ready && <span className="count-badge">{members.length}</span>}</h2>
        {ready && members.length >= SEARCH_FROM && (
          <label className="checkin-search member-search">
            <Search size={15} aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" aria-label="Search members" />
          </label>
        )}
        {!ready ? (
          <p className="hub-empty">Loading members…</p>
        ) : !leads.length && !others.length ? (
          <p className="hub-empty">No one matches.</p>
        ) : (
          <>
            {leads.length > 0 && <h3 className="member-group">Owner &amp; managers</h3>}
            {leads.map(row)}
            {others.length > 0 && <h3 className="member-group">Members</h3>}
            {others.map(row)}
          </>
        )}
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
          title={`Remove ${confirm.member.name}?`} message="They lose access to this club. They can join again." confirmLabel="Remove"
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
          title={`Leave ${club.name}?`} message="You lose access to this club. You can join again (a private club needs an invite link)." confirmLabel="Leave club"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            act(async () => { await actions.leave(); navigate("/"); }, null, "Couldn't leave. Check your connection and try again.");
          }}
        />
      )}
    </div>
  );
}
