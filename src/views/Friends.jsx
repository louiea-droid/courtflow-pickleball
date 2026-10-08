import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import PageTitle from "../components/PageTitle";
import { useFriendActions, useFriendSearch } from "../hooks/useFriends";
import { friendBuckets, relationTo } from "../utils/friends";

const HINTS = {
  idle: "Search by name or friend code. Your own code is on your Profile.",
  short: "Type at least 2 letters of a name, or paste a friend code.",
  error: "Couldn't search. Check your connection and try again.",
};

// Find people by name or friend code, answer requests, and see your friends.
export default function Friends({ uid, name, friendships, ready, notify }) {
  const { friends, received, sent } = friendBuckets(friendships, uid);
  const actions = useFriendActions({ uid, name });
  const { results, status, search } = useFriendSearch(uid);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null); // a friend being removed

  // One action at a time; a failure says so instead of failing silently.
  const act = async (key, fn, okMessage, failMessage) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      if (okMessage) notify(okMessage);
    } catch {
      notify(failMessage, 4000);
    }
    setBusy("");
  };
  const submit = (e) => { e.preventDefault(); search(text); };
  const between = (otherId) => friendships.find((f) => f.users.includes(otherId));

  const resultAction = (p) => {
    const relation = relationTo(friendships, uid, p.id);
    if (relation === "friends") return <span className="pill">Friends</span>;
    if (relation === "sent") return <span className="pill off">Requested</span>;
    if (relation === "received") {
      const f = between(p.id);
      return (
        <button className="primary" disabled={Boolean(busy)} onClick={() => act(`acc-${f.id}`, () => actions.accept(f), `You and ${p.name} are friends.`, "Couldn't accept. Try again.")}>Accept</button>
      );
    }
    return (
      <button className="outline" disabled={Boolean(busy)} onClick={() => act(`add-${p.id}`, () => actions.sendRequest(p), `Request sent to ${p.name}.`, "Couldn't send the request. Check your connection and try again.")}>
        <UserPlus size={15} /> Add friend
      </button>
    );
  };

  return (
    <div className="page-narrow">
      <PageTitle title="Friends" sub="Find people by name or friend code and keep them close." />

      <div className="panel members-block">
        <h2 className="club-section">Add a friend</h2>
        <form className="friend-search" onSubmit={submit} role="search">
          <input
            type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={60}
            placeholder="Name or friend code" aria-label="Search for a friend"
          />
          <button className="primary" disabled={status === "loading"}><Search size={15} /> Search</button>
        </form>
        {status === "done" ? (
          results.length === 0 ? (
            <p className="members-help">No one found. Check the spelling, or ask for their friend code (people can hide from the name search).</p>
          ) : (
            results.map((p) => (
              <div className="member-row" key={p.id}>
                <div className="member-main"><b>{p.name}</b></div>
                <div className="member-actions">{resultAction(p)}</div>
              </div>
            ))
          )
        ) : status === "loading" ? (
          <p className="members-help">Searching…</p>
        ) : (
          <p className="members-help" role={status === "error" ? "alert" : undefined}>{HINTS[status]}</p>
        )}
      </div>

      {(received.length > 0 || sent.length > 0) && (
        <div className="panel members-block">
          <h2 className="club-section">Requests <span className="count-badge">{received.length + sent.length}</span></h2>
          {received.map((f) => (
            <div className="member-row" key={f.id}>
              <div className="member-main"><b>{f.name}</b><small>Wants to be your friend</small></div>
              <div className="member-actions">
                <button className="primary" disabled={Boolean(busy)} onClick={() => act(`acc-${f.id}`, () => actions.accept(f), `You and ${f.name} are friends.`, "Couldn't accept. Try again.")}>Accept</button>
                <button className="outline" disabled={Boolean(busy)} onClick={() => act(`dec-${f.id}`, () => actions.remove(f), `Declined ${f.name}.`, "Couldn't decline. Try again.")}>Decline</button>
              </div>
            </div>
          ))}
          {sent.map((f) => (
            <div className="member-row" key={f.id}>
              <div className="member-main"><b>{f.name}</b><small>Waiting for them to accept</small></div>
              <div className="member-actions">
                <button className="outline" disabled={Boolean(busy)} onClick={() => act(`can-${f.id}`, () => actions.remove(f), "Request cancelled.", "Couldn't cancel. Try again.")}>Cancel</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="panel members-block">
        <h2 className="club-section">My friends {ready && friends.length > 0 && <span className="count-badge">{friends.length}</span>}</h2>
        {!ready ? (
          <p className="hub-empty">Loading…</p>
        ) : friends.length === 0 ? (
          <p className="hub-empty">No friends yet. Search by name or friend code above.</p>
        ) : friends.map((f) => (
          <div className="member-row" key={f.id}>
            <div className="member-main"><b>{f.name}</b></div>
            <div className="member-actions">
              <button className="outline" disabled={Boolean(busy)} onClick={() => setConfirm(f)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {confirm && (
        <ConfirmDialog
          title={`Remove ${confirm.name} as a friend?`} message="You can add each other again later." confirmLabel="Remove"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const f = confirm;
            setConfirm(null);
            act(`rem-${f.id}`, () => actions.remove(f), `${f.name} was removed.`, "Couldn't remove them. Check your connection and try again.");
          }}
        />
      )}
    </div>
  );
}
