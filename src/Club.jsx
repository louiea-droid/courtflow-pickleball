import { useClub } from "./hooks/useClub";
import { sessionBase } from "./utils/paths";
import QueueApp from "./QueueApp";

// The quick session at /club: the classic queue app on sessions/{uid}, no booking, no login.
export default function Club() {
  const { club, error, endSession, eraseSession } = useClub();
  if (!club) {
    return error ? (
      <div className="loading">{error}</div>
    ) : (
      <div className="loading"><span className="spinner" />Starting your session…</div>
    );
  }
  return <QueueApp base={sessionBase(club.id)} onEndSession={endSession} onErase={eraseSession} onHome={() => window.location.assign("/")} />;
}
