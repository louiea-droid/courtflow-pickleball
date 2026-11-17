import { useState } from "react";
import { Lock } from "lucide-react";
import { useMyJoinRequest } from "../hooks/useMembership";

// What a signed-in person who is not in the club sees: use an invite link, or join a public club in one tap
// (private clubs are invite only). Once they are a member the club page switches to the member view by itself.
export default function JoinPanel({ uid, clubId, club, invite, inviteRole = "member", actions, notify, onJoined }) {
  const { request, ready } = useMyJoinRequest(uid, clubId);
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
        <h2 className="club-section">You're invited to join {club.name}{inviteRole === "manager" ? " as a manager" : ""}</h2>
        <p>{inviteRole === "manager" ? "Joining makes you a manager right away: you can run open play and games, and approve requests." : "Joining adds you as a member right away."}</p>
        {error && <p className="join-error" role="alert">{error}</p>}
        <button
          className="primary" disabled={busy}
          onClick={() => run(async () => { await actions.joinWithInvite(invite, inviteRole); notify(`You joined ${club.name}.`); onJoined(); },
            (err) => (err?.code === "permission-denied"
              ? `This invite link is no longer valid. Ask ${inviteRole === "manager" ? "the owner" : "a manager"} for a new one.`
              : "Couldn't join. Check your connection and try again."))}
        >
          Join club
        </button>
      </div>
    );
  }

  if (club.visibility === "public") {
    return (
      <div className="panel join-panel">
        <h2 className="club-section">Join {club.name}</h2>
        <p>Anyone can join this club. Members see the club feed and chat, their place in the queue, and every game.</p>
        {error && <p className="join-error" role="alert">{error}</p>}
        <button
          className="primary" disabled={busy}
          onClick={() => run(async () => { await actions.join(); notify(`You joined ${club.name}.`); onJoined(); }, "Couldn't join. Check your connection and try again.")}
        >
          Join club
        </button>
      </div>
    );
  }

  if (!ready) return <p className="hub-empty">Loading…</p>;

  // A request sent while the club was still public: it can still be withdrawn or dismissed.
  if (request) {
    return (
      <div className="panel join-panel">
        <h2 className="club-section">{request.status === "declined" ? "Your request was declined" : "Request sent"}</h2>
        <p>This club is invite only now. Ask a manager for an invite link.</p>
        {error && <p className="join-error" role="alert">{error}</p>}
        <button className="outline" disabled={busy} onClick={() => run(actions.cancelRequest, "Couldn't update the request. Try again.")}>
          {request.status === "declined" ? "Dismiss" : "Withdraw request"}
        </button>
      </div>
    );
  }

  return <div className="panel notice"><p><Lock size={14} /> This club is private and invite only. Ask a manager for an invite link.</p></div>;
}
