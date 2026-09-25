import { useState } from "react";
import { Download, ChevronDown } from "lucide-react";
import PanelHead from "../components/PanelHead";
import PersonBadge from "../components/PersonBadge";
import { winPct, formatDate } from "../utils/format";
import { useSessionHistory } from "../hooks/useSessionHistory";

function PastSession({ entry }) {
  const [open, setOpen] = useState(false);
  const ranked = [...entry.players].sort((a, b) => winPct(b) - winPct(a) || b.wins - a.wins);
  const top = ranked[0];

  return (
    <div className="history-entry">
      <button className="history-entry-head" onClick={() => setOpen((o) => !o)}>
        <div>
          <b>{formatDate(entry.endedAt)}</b>
          <small>{entry.matches} match{entry.matches === 1 ? "" : "es"} · {entry.players.length} players</small>
        </div>
        {top && <span className="history-top">Top: {top.name} ({winPct(top)}%)</span>}
        <ChevronDown size={15} className={open ? "rot" : ""} />
      </button>
      {open && (
        <div className="history-entry-body">
          {ranked.map((p, i) => (
            <div className="leader" key={p.id}>
              <strong>{i + 1}</strong>
              <PersonBadge name={p.name} />
              <span>{p.games} games</span>
              <span>{p.wins} wins</span>
              <div>
                <small>{winPct(p)}%</small>
                <div className="bar"><i style={{ width: `${winPct(p)}%` }} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Stats({ players, exportCsv, sessionId }) {
  const matches = Math.round(players.reduce((n, p) => n + p.games, 0) / 2);
  const wins = players.reduce((n, p) => n + p.wins, 0);
  const avg = players.length
    ? (players.reduce((n, p) => n + p.games, 0) / players.length).toFixed(1)
    : 0;
  const ranked = [...players].sort((a, b) => winPct(b) - winPct(a) || b.wins - a.wins);
  const history = useSessionHistory(sessionId);

  return (
    <>
      <div className="heading">
       
        <button className="outline" onClick={exportCsv}><Download /> Export CSV</button>
      </div>
      <div className="bigstats">
        <div><span>TOTAL MATCHES</span><b>{matches}</b><small>completed games</small></div>
        <div><span>TOTAL WINS</span><b>{wins}</b><small>team wins recorded</small></div>
        <div><span>AVG GAMES / PLAYER</span><b>{avg}</b><small>current session</small></div>
      </div>
      <div className="panel">
        <PanelHead title="Leaderboard" sub="Sorted by win percentage, then wins." />
        {ranked.map((p, i) => (
          <div className="leader" key={p.id} style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <strong>{i + 1}</strong>
            <PersonBadge name={p.name} skill={p.skill} />
            <span>{p.games} games</span>
            <span>{p.wins} wins</span>
            <div>
              <small>{winPct(p)}%</small>
              <div className="bar"><i style={{ width: `${winPct(p)}%` }} /></div>
            </div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="panel history-panel">
          <PanelHead
            title="Past Sessions"
            sub="Saved automatically each time this club continues — nothing gets lost when games renew."
          />
          {history.map((entry) => <PastSession key={entry.id} entry={entry} />)}
        </div>
      )}
    </>
  );
}
