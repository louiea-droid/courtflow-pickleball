import { Fragment, useEffect, useRef, useState } from "react";
import { CircleDot, CircleHelp, SlidersHorizontal, Undo2 } from "lucide-react";
import { adjust, call, confirmScore, finalText, firstServe, gamePoint, lastEvent, liveScore, rally, undo, winner } from "../utils/scoring";

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

// The call in parts, each with the team it belongs to: serving team score, receiving team score, server number.
const callParts = (s) => {
  const serve = s.serving, recv = serve === 1 ? 2 : 1;
  const pts = (t) => (t === 1 ? s.t1 : s.t2);
  return [[pts(serve), serve], [pts(recv), recv], ...(s.singles ? [] : [[s.server, serve]])];
};

// A finished game saves itself after this many seconds; Undo in that time keeps it open.
const SAVE_AFTER_S = 5;

const namesOf = (ids, players) => (ids || []).map((id) => players.find((p) => p.id === id)?.name || "Player");

// Team 1 is always on the left and Team 2 on the right, each with its own score, so a number never changes sides.
// Each half is the button: tap the side of the team that won the rally. "Fix the score" and "How scoring works" sit
// below the board, or beside it when there is room (the volunteer page on a desktop); `page` opens them there.
export default function ScoreKeeper({ court, players, settings, onScore, onConfirm, onStop, page = false, autoRecord = settings?.autoRecord }) {
  const [wide] = useState(() => page && typeof window !== "undefined" && !!window.matchMedia?.("(min-width: 1100px)").matches);
  const empty = !(court.teamA?.length || court.teamB?.length);
  const s = liveScore(court, settings);
  const won = winner(s);
  // A finished game is saved after a short countdown (a wrong last tap can still be undone). With "Record umpire results
  // automatically" off the host then confirms it (the court card, or the Confirm button here in the manager's pop-up);
  // on, a manager's save records it at once and a volunteer's is recorded by the host's queue.
  const [left, setLeft] = useState(SAVE_AFTER_S);
  const save = useRef(null);
  save.current = () => (autoRecord && onConfirm ? onConfirm(won === 1 ? "A" : "B") : onScore(confirmScore(s)));
  const finishing = !empty && won && !s.confirmed ? `${court.id}:${s.start}:${s.t1}:${s.t2}` : null;
  useEffect(() => {
    if (!finishing) return undefined;
    const started = Date.now();
    setLeft(SAVE_AFTER_S);
    const timer = setInterval(() => {
      const remain = SAVE_AFTER_S - Math.floor((Date.now() - started) / 1000);
      if (remain > 0) return setLeft(remain);
      clearInterval(timer);
      save.current();
    }, 250);
    return () => clearInterval(timer);
  }, [finishing]);
  if (empty) return <p className="scorekeeper-empty">No match on this court yet.</p>;
  const sideout = s.style !== "rally";
  const point = gamePoint(s);
  const event = lastEvent(s);
  const fresh = s.log.length === 0 && s.t1 + s.t2 === 0;
  const teams = [[1, court.teamA, "team1"], [2, court.teamB, "team2"]];
  return (
    <div className="scorekeeper">
      <div className="scorekeeper-layout">
        <div className="scorekeeper-main">
          {sideout && !won && (
            <div className="scorekeeper-call" aria-label={`Score call ${call(s)}`}>
              {callParts(s).map(([value, team], i) => (
                <Fragment key={i}>{i ? <i>-</i> : null}<b className={`t${team}`}>{value}</b></Fragment>
              ))}
            </div>
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
                  <span className="scorekeeper-hint">{won ? (won === n ? "Winner" : "") : "Won the rally"}</span>
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
              {!s.confirmed ? <p>{`Saving in ${left} s. Tap Undo to change it.`}</p>
                : onConfirm ? <button className={`court-confirm team${won}`} onClick={() => onConfirm(won === 1 ? "A" : "B")}>Confirm: Team {won} wins {finalText(s)}</button>
                : <p>{autoRecord ? "Saved. The next match goes on this court." : "Saved. The host confirms the result on their screen."}</p>}
            </div>
          ) : null}
        </div>

        <details className="scorekeeper-card scorekeeper-fix" open={wide}>
          <summary><SlidersHorizontal size={16} /> Fix the score</summary>
          <p className="scorekeeper-card-note">For a missed or wrong call. Undo reverses a fix too.</p>
          {teams.map(([n]) => (
            <div className="scorekeeper-stepper" data-team={n} key={n}>
              <span>Team {n}</span>
              <button className="outline" aria-label={`Team ${n} minus one`} disabled={(n === 1 ? s.t1 : s.t2) === 0}
                onClick={() => onScore(adjust(s, n, -1))}>-1</button>
              <b aria-label={`Team ${n} score`}>{n === 1 ? s.t1 : s.t2}</b>
              <button className="outline" aria-label={`Team ${n} plus one`} onClick={() => onScore(adjust(s, n, 1))}>+1</button>
            </div>
          ))}
          {onStop && (
            <button className="outline scorekeeper-stop" onClick={onStop}>Stop scoring this match</button>
          )}
        </details>

        <details className="scorekeeper-card scorekeeper-help" open={wide}>
          <summary><CircleHelp size={16} /> How scoring works</summary>
          {sideout ? (
            <>
              <ol>
                <li><b>Only the serving team scores.</b> Win the rally on your serve and you get a point.</li>
                <li><b>Lose a rally on your serve</b> and your partner serves next (server 2).</li>
                <li><b>Lose again</b> and it is a side out: the other team serves.</li>
              </ol>
              <p>The call reads <b>serving score - receiving score - server</b>, e.g. 4 - 2 - 1. First to {s.to}, win by 2.</p>
            </>
          ) : (
            <p><b>Every rally scores</b> a point for the team that won it. First to {s.to}, win by 2.</p>
          )}
        </details>
      </div>
    </div>
  );
}
