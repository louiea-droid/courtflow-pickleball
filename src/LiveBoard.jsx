import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, db, firebaseConfigured } from "./firebase";
import { docsOf } from "./hooks/useLiveDocs";
import { liveTarget } from "./utils/liveBoard";
import { joinAsViewer } from "./utils/liveData";
import { useSessionData } from "./hooks/useSessionData";
import { useCosts } from "./hooks/useCosts";
import { useMatchLog } from "./hooks/useMatchLog";
import MatchLogRow from "./components/MatchLogRow";
import PhClock from "./components/PhClock";
import StarDisplay from "./components/StarDisplay";
import ElapsedTimer from "./components/ElapsedTimer";
import { CircleDot } from "lucide-react";
import { call, winner } from "./utils/scoring";
import { applyDisplayPrefs, money } from "./utils/format";
import { applyGlobalTheme } from "./utils/theme";
import { DEFAULT_LIVE, normalizeMode } from "./data/constants";
import { upNextByCourt } from "./utils/rotationModes";
import { queueOrder } from "./utils/queueStatus";

// serving: "Server 2" / "Serving" on the serving team; state: "winner" / "lost" once a game is decided.
function LiveTeam({ label, color, ids, players, showSkill, serving = null, state = null }) {
  return (
    <div className={`team${state === "lost" ? " live-lost" : ""}`}>
      <div className={`${color} live-team-head`}>
        <span className="live-team-name">{label}</span>
        {serving && <em className="live-serve"><CircleDot size={12} /> {serving.startsWith("Server ") ? <><span className="live-serve-word">Server </span>{serving.slice(7)}</> : serving}</em>}
        {state === "winner" && <em className="live-serve">Winner</em>}
      </div>
      {ids.map((id) => {
        const p = players.find((x) => x.id === id);
        if (!p) return null;
        return (
          <div className="chip" key={id}>
            <div><b>{p.name}</b>{showSkill && <small><StarDisplay value={p.skill} /></small>}</div>
          </div>
        );
      })}
    </div>
  );
}

function LiveCourt({ c, players, showSkill }) {
  const isEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
  const sc = c.score && c.score.start === c.start ? c.score : null; // an old match's score never shows
  // The score sits in the middle between the two teams, each number in its team's color (Team 1 left, so it never swaps
  // sides); the serving badge is on the serving team's bar and the official call is small in the top row.
  const won = sc ? winner(sc) : 0;
  const serving = sc && !won ? (sc.style !== "rally" && !sc.singles ? `Server ${sc.server}` : "Serving") : null;
  const teamProps = (n) => (sc ? {
    serving: sc.serving === n ? serving : null,
    state: won ? (won === n ? "winner" : "lost") : null,
  } : {});
  return (
    <div className="court">
      <div className="court-top">
        <b>{c.name || `Court ${c.courtNumber}`}</b>
        {c.level && c.level !== "Any Level" && <span className="badge-level-quiet">{c.level}</span>}
        {isEmpty ? <span className="badge-open">OPEN</span> : <span>● LIVE</span>}
        {!isEmpty && sc && !won && sc.style !== "rally" && <em className="live-call" title="Score call">{call(sc)}</em>}
        {!isEmpty && <ElapsedTimer start={c.start} />}
      </div>
      {isEmpty ? (
        <div className="court-empty"><p>Court is open.</p></div>
      ) : (
        <div className={`teams${sc ? " live-scored" : ""}`}>
          <LiveTeam label="Team 1" color="team1" ids={c.teamA || []} players={players} showSkill={showSkill} {...teamProps(1)} />
          {sc && (
            <div className="live-mid" aria-label={`Score: Team 1 ${sc.t1}, Team 2 ${sc.t2}`}>
              <b className="t1">{sc.t1}</b><i>-</i><b className="t2">{sc.t2}</b>
            </div>
          )}
          <LiveTeam label="Team 2" color="team2" ids={c.teamB || []} players={players} showSkill={showSkill} {...teamProps(2)} />
        </div>
      )}
    </div>
  );
}

// A fixed-height list with no scrollbar: if every row fits, it just sits
// still. If it overflows, the list is duplicated back-to-back and animated in
// a continuous, seamless vertical scroll — smooth motion, not a jump-cut —
// sized so every waiting player keeps drifting into view on an unattended
// display (e.g. a TV), and paced by row count so it's never rushed.
function QueueTicker({ rows, rowCount }) {
  const wrapRef = useRef(null);
  const contentRef = useRef(null);
  const [scrolling, setScrolling] = useState(false);
  const [duration, setDuration] = useState(20);

  useEffect(() => {
    const wrap = wrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;
    const measure = () => {
      const overflow = content.scrollHeight > wrap.clientHeight + 2;
      setScrolling(overflow);
      if (overflow) setDuration(Math.max(10, content.scrollHeight / 28));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(content);
    return () => ro.disconnect();
  }, [rowCount]);

  return (
    <div className="ticker" ref={wrapRef}>
      <div
        className={`ticker-track ${scrolling ? "scrolling" : ""}`}
        style={scrolling ? { animationDuration: `${duration}s` } : undefined}
      >
        <div className="ticker-content" ref={contentRef}>{rows}</div>
        {scrolling && <div className="ticker-content" aria-hidden="true">{rows}</div>}
      </div>
    </div>
  );
}

// A game's board (/live?club=C&event=E&key=K): the screen signs in anonymously, registers with the link key, then listens
// to the game. The event and club docs aren't readable here, so the title and settings come from events/{e}/private/live.
// Any refused read (new link, game over for 12 hours, event deleted) ends the board.
function useGameBoard(target) {
  const active = target?.kind === "event";
  const path = active ? target.base.join("/") : "";
  const [state, setState] = useState({ busy: active, dead: false, info: null, players: [], courts: [], matchLog: [] });
  useEffect(() => {
    if (!active || !firebaseConfigured) return undefined;
    const base = path.split("/");
    let offs = [];
    let stopped = false;
    const dead = () => setState((s) => ({ ...s, busy: false, dead: true }));
    const loaded = new Set();
    const ready = (part) => { loaded.add(part); if (loaded.size === 3) setState((s) => ({ ...s, busy: false })); };
    const unAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) { signInAnonymously(auth).catch(dead); return; }
      if (offs.length) return;
      try { await joinAsViewer(base, user.uid, target.key); } catch { dead(); return; }
      if (stopped) return;
      offs = [
        onSnapshot(doc(db, ...base, "private", "live"), (s) => {
          if (!s.exists()) { dead(); return; }
          setState((st) => ({ ...st, info: s.data() }));
          ready("info");
        }, dead),
        onSnapshot(collection(db, ...base, "players"), (s) => {
          setState((st) => ({ ...st, players: docsOf(s).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)) }));
          ready("players");
        }, dead),
        onSnapshot(collection(db, ...base, "courts"), (s) => {
          setState((st) => ({ ...st, courts: docsOf(s).sort((a, b) => (a.courtNumber || 0) - (b.courtNumber || 0)) }));
          ready("courts");
        }, dead),
        onSnapshot(query(collection(db, ...base, "matchLog"), orderBy("recordedAt", "desc"), limit(20)),
          (s) => setState((st) => ({ ...st, matchLog: docsOf(s) })), dead),
      ];
    });
    return () => { stopped = true; unAuth(); offs.forEach((off) => off()); };
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  const info = state.info || {};
  const session = {
    location: info.clubName && info.title ? `${info.clubName} · ${info.title}` : info.title || info.clubName || "Open play",
    format: info.format || "Doubles", mode: info.mode, display: info.display, live: info.live,
  };
  return { active, ...state, session };
}

export default function LiveBoard() {
  const target = useMemo(() => liveTarget(window.location.search), []);
  const quickBase = target?.kind === "quick" ? target.base : null;
  const quick = useSessionData(quickBase);
  const quickCosts = useCosts(quickBase);
  const quickLog = useMatchLog(quickBase);
  const game = useGameBoard(target);
  const { session, players, courts, busy } = game.active ? game : quick;
  const costs = game.active ? [] : quickCosts; // a game's costs stay with its managers
  const matchLog = game.active ? game.matchLog : quickLog;

  // Keep a wall TV or tablet from dimming or sleeping while the board is up.
  // The browser drops the lock whenever the tab is hidden, so re-request on return.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock = null;
    const request = () => {
      if (document.visibilityState === "visible") navigator.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => {});
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => { document.removeEventListener("visibilitychange", request); lock?.release(); };
  }, []);

  useEffect(() => {
    document.title = session.location ? `${session.location} — Live Board` : "CourtWave — Live Board";
  }, [session.location]);

  if (!firebaseConfigured) {
    return <div className="loading">Live board unavailable — Firebase isn't configured.</div>;
  }
  if (game.dead) {
    return <div className="loading">This Live Board is no longer active. Ask the host for the new link.</div>;
  }
  if (!target) {
    return <div className="loading">No club specified. Ask for a fresh share link from the app.</div>;
  }
  if (busy) {
    return (
      <div className="loading">
        <span className="spinner" />
        Loading live board…
      </div>
    );
  }

  // Club's Live Board settings (Settings page). These only gate this page —
  // session data stays readable by anyone with the club id (Firestore rules).
  const live = { ...DEFAULT_LIVE, ...session.live };
  applyDisplayPrefs(session.display);
  applyGlobalTheme(session.display);
  if (!live.enabled) {
    return <div className="loading">This Live Board is turned off. Ask the club to switch it back on.</div>;
  }
  if (!game.active && live.key && new URLSearchParams(window.location.search).get("key") !== live.key) {
    return <div className="loading">This link is no longer active. Ask the club for the new Live Board link.</div>;
  }

  const queue = queueOrder(players, courts);
  const visibleCosts = costs.filter((c) => c.visibleOnLive);
  // "Next" is the queue app's own pick for each court (the host's Up Next), so the board agrees with the Dashboard.
  const picks = upNextByCourt({ pool: queue, courts, mode: normalizeMode(session.mode || session.rotation) || "Balanced",
    need: session.format === "Singles" ? 2 : 4, now: Date.now() });
  const nextCourt = Object.fromEntries(courts.flatMap((c) => (picks[c.id] || []).map((p) => [p.id, c.name || `Court ${c.courtNumber}`])));

  const queueRows = queue.map((p, i) => (
    <div className="queue-row" key={p.id}>
      {live.showQueueRank && <span className="queue-rank">{i + 1}</span>}
      <b>{p.name}</b>
      {nextCourt[p.id] && <span className="queue-next">Next · {nextCourt[p.id]}</span>}
      {live.showSkill && <StarDisplay value={p.skill} />}
      {live.showStats && (
        <span className="queue-stats">
          <span className="queue-stat games">{p.games} <small>games</small></span>
          <span className="queue-stat wins">{p.wins} <small>wins</small></span>
          <span className="queue-stat losses">{p.losses || 0} <small>losses</small></span>
        </span>
      )}
    </div>
  ));

  return (
    <div className="liveboard">
      <header className="liveboard-header">
        <div className="liveboard-brand">
          <img className="liveboard-logo" src="/images/courtwave.png" alt="CourtWave" />
          <div>
            <div className="eyebrow">LIVE BOARD</div>
            <h1>{session.location}</h1>
            <p>{courts.length} {courts.length === 1 ? "court" : "courts"} · {session.format}</p>
          </div>
        </div>
        <PhClock />
      </header>

      {visibleCosts.length > 0 && (
        <div className="liveboard-cost-strip">
          {visibleCosts.map((c) => (
            <div className="cost-chip" key={c.id}>
              <b>{c.label}</b>
              <span>{money(c.total)} total · {money(c.perPerson)} / player</span>
            </div>
          ))}
        </div>
      )}

      <div className="liveboard-body">
        <section className="liveboard-col liveboard-courts-col">
          <div className="liveboard-section-title"><h2>Live Courts</h2></div>
          <div className="liveboard-courts-grid">
            {courts.map((c) => <LiveCourt key={c.id} c={c} players={players} showSkill={live.showSkill} />)}
            {!courts.length && <div className="empty">No courts yet.</div>}
          </div>
        </section>

        <div className="liveboard-bottom-row">
          <section className="liveboard-col liveboard-queue-col">
            <div className="liveboard-section-title">
              <h2>Waiting Queue</h2>
              <span className="count-badge">{queue.length}</span>
            </div>
            <div className="panel liveboard-box">
              {queue.length ? (
                <QueueTicker rows={queueRows} rowCount={queue.length} />
              ) : (
                <div className="empty">Queue is empty.</div>
              )}
            </div>
          </section>

          <section className="liveboard-col liveboard-matchlog-col">
            <div className="liveboard-section-title"><h2>Match Log</h2></div>
            <div className="panel liveboard-box">
              {matchLog.length ? (
                <div className="matchlog-list">
                  {matchLog.slice(0, 5).map((m, i) => <MatchLogRow match={m} latest={i === 0} key={m.id} />)}
                </div>
              ) : (
                <div className="empty">No matches recorded yet.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
