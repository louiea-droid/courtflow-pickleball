import { Trophy } from "lucide-react";
import { formatTime } from "../utils/format";

// One recorded match result, shared between the Dashboard's Match Log panel and the public Live Board.
// A header with the court and when it ended (the newest match is tinted), then one line
// for the winners ("Won", bold) and one for the losers ("Lost", muted), so the result reads at a glance.
export default function MatchLogRow({ match, latest = false }) {
  return (
    <div className={`matchlog-row${latest ? " latest" : ""}`}>
      <div className="matchlog-meta">
        <span className="matchlog-court">{match.court}</span>
        {match.recordedAt && <span className="matchlog-time">{formatTime(match.recordedAt)}</span>}
      </div>
      <div className="matchlog-line win">
        <span className="matchlog-won"><Trophy size={11} /> Won</span>
        <span className="matchlog-names">{match.winners.join(" & ")}</span>
      </div>
      <div className="matchlog-line loss">
        <span className="matchlog-lost">Lost</span>
        <span className="matchlog-names">{match.losers.join(" & ")}</span>
      </div>
    </div>
  );
}
