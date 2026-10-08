import { useState } from "react";
import { Lock } from "lucide-react";
import { useMyJoinRequest } from "../hooks/useMembership";
import { JOIN_MESSAGE_MAX, validateJoinMessage } from "../utils/clubs";

// What a signed-in person who is not in the club sees: use an invite link, or ask to join a public
// club. Once they are a member the club page switches to the member view by itself.
export default function JoinPanel({ uid, clubId, club, invite, actions, notify, onJoined }) {
  const { request, ready } = useMyJoinRequest(uid, clubId);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (fn, failMessage) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(typeof failMessage === "function" ? failMessage(err) : failMessage);
    }
    setBusy(false);
  };

  if (invite) {
    return (
      <div className="panel join-panel">
        <h2 className="club-section">You're invited to join {club.name}</h2>
        <p>Joining adds you as a member right away.</p>
        {error && <p className="join-error" role="alert">{error}</p>}
        <button
          className="primary" disabled={busy}
          onClick={() => run(async () => { await actions.joinWithInvite(invite); notify(`You joined ${club.name}.`); onJoined(); },
            (err) => (err?.code === "permission-denied"
              ? "This invite link is no longer valid. Ask a manager for a new one."
              : "Couldn't join. Check your connection and try again."))}
        >
          Join club
        </button>
      </div>
    );
  }

  if (club.visibility !== "public") {
    return <div className="panel notice"><p><Lock size={14} /> This club is private. Ask a manager for an invite link.</p></div>;
  }
  if (!ready) return <p className="hub-empty">Loading…</p>;

  if (request?.status === "pending") {
    return (
      <div className="panel join-panel">
        <h2 className="club-section">Request sent</h2>
        <p>A manager will review it. You'll see the club's members here once you're in.</p>
        {error && <p className="join-error" role="alert">{error}</p>}
        <button className="outline" disabled={busy} onClick={() => run(actions.cancelRequest, "Couldn't withdraw the request. Try again.")}>Withdraw request</button>
      </div>
    );
  }
  if (request?.status === "declined") {
    return (
      <div className="panel join-panel">
        <h2 className="club-section">Your request was declined</h2>
        <p>You can dismiss this and ask again later.</p>
        {error && <p className="join-error" role="alert">{error}</p>}
        <button className="outline" disabled={busy} onClick={() => run(actions.cancelRequest, "Couldn't dismiss it. Try again.")}>Dismiss</button>
      </div>
    );
  }

  const send = (e) => {
    e.preventDefault();
    const problem = validateJoinMessage(message);
    if (problem) return setError(problem);
    run(async () => { await actions.requestToJoin(message); setMessage(""); }, "Couldn't send your request. Check your connection and try again.");
  };
  return (
    <form className="panel join-panel" onSubmit={send}>
      <h2 className="club-section">Join {club.name}</h2>
      <p>Send a request. A manager will approve it.</p>
      <label>
        Message to the managers <small>(optional)</small>
        <textarea rows={3} value={message} maxLength={JOIN_MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} placeholder="Who you are and when you play." />
      </label>
      {error && <p className="join-error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>Request to join</button>
    </form>
  );
}
