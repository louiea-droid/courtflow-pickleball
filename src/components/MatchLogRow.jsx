import { Trophy } from "lucide-react";

// One recorded match result, shared between the Dashboard's Match Log panel
// and the public Live Board so both read identically. A single compact row:
// a "Won" badge, the winners bold, "vs" the losers muted, and the court —
// all on one line instead of a stacked, hard-to-scan block.
export default function MatchLogRow({ match }) {
  return (
    <div className="matchlog-row">
      <span className="matchlog-won"><Trophy size={11} /> Won</span>
      <span className="matchlog-names">
        <b>{match.winners.join(" & ")}</b> vs {match.losers.join(" & ")}
      </span>
      <span className="matchlog-court">{match.court}</span>
    </div>
  );
}
