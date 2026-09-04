import { Download } from "lucide-react";
import PanelHead from "../components/PanelHead";
import { initials, winPct } from "../utils/format";

export default function Stats({ players, exportCsv }) {
  const matches = Math.round(players.reduce((n, p) => n + p.games, 0) / 2);
  const wins = players.reduce((n, p) => n + p.wins, 0);
  const avg = players.length
    ? (players.reduce((n, p) => n + p.games, 0) / players.length).toFixed(1)
    : 0;
  const ranked = [...players].sort((a, b) => winPct(b) - winPct(a) || b.wins - a.wins);

  return (
    <>
      <div className="heading">
        <div><h2>Session Stats</h2><p>Standings and playing-time snapshot.</p></div>
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
            <span className="person"><i>{initials(p.name)}</i><b>{p.name}</b></span>
            <span>{p.games} games</span>
            <span>{p.wins} wins</span>
            <div>
              <small>{winPct(p)}%</small>
              <div className="bar"><i style={{ width: `${winPct(p)}%` }} /></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
