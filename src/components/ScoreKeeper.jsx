import { Undo2 } from "lucide-react";
import { adjust, call, finalText, firstServe, gamePoint, liveScore, rally, undo, winner } from "../utils/scoring";

// The score of one court, as the umpire sees it. Used by managers (a modal on the Dashboard) and by volunteers
// (/umpire). Nothing is kept here: every tap computes the next score from the court and sends it up.
// settings: { style, to, singles }. Without onConfirm (a volunteer) a finished game waits for the host to record it.
export function ScoreLine({ score }) {
  const sideout = score.style !== "rally" && !score.singles;
  return (
    <div className="score-line">
      <b className="t1">{score.t1}</b><i>-</i><b className="t2">{score.t2}</b>
      {winner(score) ? <small>Final</small> : sideout && <small>Team {score.serving} serving, server {score.server}</small>}
    </div>
  );
}

const namesOf = (ids, players) => (ids || []).map((id) => players.find((p) => p.id === id)?.name || "Player");

export default function ScoreKeeper({ court, players, settings, onScore, onConfirm }) {
  const empty = !(court.teamA?.length || court.teamB?.length);
  if (empty) return <p className="scorekeeper-empty">No match on this court yet.</p>;
  const s = liveScore(court, settings);
  const won = winner(s);
  const point = gamePoint(s);
  const fresh = s.log.length === 0 && s.t1 + s.t2 === 0;
  const teams = [[1, court.teamA, "team1"], [2, court.teamB, "team2"]];
  return (
    <div className="scorekeeper">
      <div className="scorekeeper-call" aria-live="polite">{call(s)}</div>
      <div className="scorekeeper-status">
        {won ? `Team ${won} wins ${finalText(s)}` : point ? `Game point: Team ${point}` : s.style === "rally" ? `Rally scoring, to ${s.to}` : `Team ${s.serving} serving, server ${s.singles ? 1 : s.server}`}
      </div>
      <div className="scorekeeper-teams">
        {teams.map(([n, ids, color]) => (
          <div className="scorekeeper-team" key={n}>
            <div className="scorekeeper-names"><b>Team {n}</b>{namesOf(ids, players).map((name, i) => <span key={i}>{name}</span>)}</div>
            <button className={`scorekeeper-rally ${color}`} disabled={!!won} onClick={() => onScore(rally(s, n))}>
              Team {n} won the rally
            </button>
          </div>
        ))}
      </div>
      <div className="scorekeeper-tools">
        <button className="outline" disabled={!s.log.length} onClick={() => onScore(undo(s))}><Undo2 size={14} /> Undo</button>
        {fresh && <button className="outline" onClick={() => onScore(firstServe(s, s.serving === 1 ? 2 : 1))}>Team {s.serving === 1 ? 2 : 1} serves first</button>}
      </div>
      <details className="scorekeeper-adjust">
        <summary>Fix the score</summary>
        <div>
          {teams.map(([n]) => (
            <div key={n}>
              <span>Team {n}</span>
              <button className="outline" aria-label={`Team ${n} minus one`} onClick={() => onScore(adjust(s, n, -1))}>-1</button>
              <button className="outline" aria-label={`Team ${n} plus one`} onClick={() => onScore(adjust(s, n, 1))}>+1</button>
            </div>
          ))}
        </div>
      </details>
      {won ? (
        <div className="scorekeeper-done">
          <b>Team {won} wins {finalText(s)}</b>
          {onConfirm
            ? <button className="primary" onClick={() => onConfirm(won === 1 ? "A" : "B")}>Confirm result</button>
            : <p>Game over. The host will record the result.</p>}
        </div>
      ) : null}
    </div>
  );
}
