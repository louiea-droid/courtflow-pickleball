import { CircleDot, Undo2 } from "lucide-react";
import { adjust, call, finalText, firstServe, gamePoint, lastEvent, liveScore, rally, undo, winner } from "../utils/scoring";

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

// Team 1 is always on the left and Team 2 on the right, each with its own score, so a number never changes sides.
// Each half is the button: tap the side of the team that won the rally.
export default function ScoreKeeper({ court, players, settings, onScore, onConfirm }) {
  const empty = !(court.teamA?.length || court.teamB?.length);
  if (empty) return <p className="scorekeeper-empty">No match on this court yet.</p>;
  const s = liveScore(court, settings);
  const sideout = s.style !== "rally";
  const won = winner(s);
  const point = gamePoint(s);
  const event = lastEvent(s);
  const fresh = s.log.length === 0 && s.t1 + s.t2 === 0;
  const teams = [[1, court.teamA, "team1"], [2, court.teamB, "team2"]];
  return (
    <div className="scorekeeper">
      {sideout && !won && (
        <div className="scorekeeper-call" aria-label={`Score call ${call(s)}`}>{call(s)}</div>
      )}
      <div className="scorekeeper-board">
        {teams.map(([n, ids, color]) => {
          const serving = !won && s.serving === n;
          const pts = n === 1 ? s.t1 : s.t2;
          return (
            <button key={n} className={`scorekeeper-side ${color}${won && won !== n ? " lost" : ""}`} disabled={!!won}
              aria-label={`Team ${n}, ${pts} points${serving ? ", serving" : ""}. Tap if Team ${n} won the rally.`}
              onClick={() => onScore(rally(s, n))}>
              <span className="scorekeeper-side-top">
                <b>Team {n}</b>
                {serving && (
                  <em><CircleDot size={13} /> {sideout && !s.singles ? `Server ${s.server}` : "Serving"}</em>
                )}
              </span>
              <span className="scorekeeper-names">{namesOf(ids, players).join(" · ")}</span>
              <span className="scorekeeper-points">{pts}</span>
              <span className="scorekeeper-hint">{won ? (won === n ? "Winner" : "") : "Tap if they won the rally"}</span>
            </button>
          );
        })}
      </div>
      <p className="scorekeeper-event" aria-live="polite">
        {won ? "" : point ? `Game point: Team ${point}` : event || (sideout ? `Team ${s.serving} serves first.` : `Rally scoring, to ${s.to}.`)}
      </p>
      <div className="scorekeeper-tools">
        <button className="outline" disabled={!s.log.length} onClick={() => onScore(undo(s))} title={event ? `Undo: ${event}` : undefined}>
          <Undo2 size={14} /> Undo
        </button>
        {fresh && <button className="outline" onClick={() => onScore(firstServe(s, s.serving === 1 ? 2 : 1))}>Team {s.serving === 1 ? 2 : 1} serves first</button>}
      </div>
      {won ? (
        <div className="scorekeeper-done">
          <b>Team {won} wins {finalText(s)}</b>
          {onConfirm
            ? <button className="primary" onClick={() => onConfirm(won === 1 ? "A" : "B")}>Confirm result</button>
            : <p>Game over. The host will record the result.</p>}
        </div>
      ) : null}
      <details className="scorekeeper-more">
        <summary>Fix the score</summary>
        <div className="scorekeeper-adjust">
          {teams.map(([n]) => (
            <div key={n}>
              <span>Team {n}</span>
              <button className="outline" aria-label={`Team ${n} minus one`} onClick={() => onScore(adjust(s, n, -1))}>-1</button>
              <button className="outline" aria-label={`Team ${n} plus one`} onClick={() => onScore(adjust(s, n, 1))}>+1</button>
            </div>
          ))}
        </div>
      </details>
      <details className="scorekeeper-more">
        <summary>How scoring works</summary>
        <p>
          {sideout
            ? `Only the serving team scores. If they lose the rally, the serve goes to their second server, then to the other team (a side out). First to ${s.to}, winning by 2.`
            : `Every rally scores a point for the team that won it. First to ${s.to}, winning by 2.`}
        </p>
      </details>
    </div>
  );
}
