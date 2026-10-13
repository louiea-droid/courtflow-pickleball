import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, db } from "./firebase";
import { authMessage } from "./utils/account";
import { docsOf } from "./hooks/useLiveDocs";
import ScoreKeeper from "./components/ScoreKeeper";
import { umpireTarget } from "./utils/umpire";
import { claimCourt, deleteOwnRecord, joinAsUmpire, readOwnRecord, readSettings, releaseCourt, writeScore } from "./utils/umpireData";

// /umpire?club=C&event=E&code=K (a game) or ?session=S&code=K (a quick session): a volunteer with no account keeps the
// score of one court. They register with the link's code, claim a free court, and may change only that court's score.
const NAME_KEY = "courtflow.umpireName";
const readName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } };
const saveName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* private window: just don't remember it */ } };

function Page({ children }) {
  return (
    <div className="umpire-page">
      <h1>Umpire</h1>
      {children}
    </div>
  );
}

const namesOf = (ids, players) => (ids || []).map((id) => players.find((p) => p.id === id)?.name || "Player").join(" & ") || "Open";

export default function Umpire() {
  const target = useMemo(() => umpireTarget(window.location.search), []);
  const key = target ? target.base.join("/") : "";
  const [uid, setUid] = useState(null);
  const [authError, setAuthError] = useState("");
  const [name, setName] = useState(readName);
  const [regName, setRegName] = useState(""); // the name on the registration, which every claim must carry
  const [stage, setStage] = useState("name"); // name | joining | ready | dead
  const [settings, setSettings] = useState(null);
  const [courts, setCourts] = useState([]);
  const [players, setPlayers] = useState([]);
  const [claims, setClaims] = useState([]);
  const [notice, setNotice] = useState("");

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (user) { setUid(user.uid); return; }
    // No one signed in: a quiet anonymous session (a real account already signed in is reused, never signed out).
    signInAnonymously(auth).catch((err) => setAuthError(
      err.code === "auth/operation-not-allowed" || err.code === "auth/admin-restricted-operation"
        ? "Umpire links need anonymous sign-in turned on for this project. Contact the admin."
        : authMessage(err)));
  }), []);

  // The courts, players and claims, live. A refused read means the link was replaced, the game ended or the host turned this off.
  useEffect(() => {
    if (stage !== "ready") return undefined;
    const dead = () => setStage("dead");
    const sub = (coll, set) => onSnapshot(collection(db, ...target.base, coll), (s) => set(docsOf(s)), dead);
    const off = [sub("courts", setCourts), sub("players", setPlayers), sub("courtClaims", setClaims),
      // The scoring style and target follow the host's settings while the page is open.
      onSnapshot(doc(db, ...target.base, "private", "umpire"), (s) => (s.exists() ? setSettings(s.data()) : dead()), dead)];
    return () => off.forEach((f) => f());
  }, [stage, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return <Page><p className="umpire-note">This umpire link is incomplete. Ask the host to share it again.</p></Page>;
  if (authError) return <Page><p className="umpire-note">{authError}</p></Page>;
  if (stage === "dead") {
    return <Page><p className="umpire-note"><b>This umpire link is no longer active.</b> Ask the host for a new link.</p></Page>;
  }

  async function start(e) {
    e.preventDefault();
    const who = name.trim();
    if (!who || !uid) return;
    saveName(who);
    setStage("joining");
    try {
      const own = await readOwnRecord(target.base, uid);
      const current = own && own.code === target.code;
      if (own && !current) await deleteOwnRecord(target.base, uid);
      if (!current) await joinAsUmpire(target.base, uid, { code: target.code, name: who });
      setRegName(current ? own.name : who.slice(0, 40));
      const s = await readSettings(target.base);
      if (!s) throw new Error("no settings");
      setSettings(s);
      setStage("ready");
    } catch {
      setStage("dead");
    }
  }

  if (stage !== "ready") {
    return (
      <Page>
        <form className="umpire-form" onSubmit={start}>
          <label>Your name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name shown to the host" autoFocus />
          </label>
          <button className="primary" disabled={!name.trim() || !uid || stage === "joining"}>
            {stage === "joining" ? "Joining..." : "Start umpiring"}
          </button>
        </form>
      </Page>
    );
  }

  const sorted = [...courts].sort((a, b) => (a.courtNumber || 0) - (b.courtNumber || 0));
  const mine = claims.find((c) => c.uid === uid);
  const court = mine && courts.find((c) => c.id === mine.id);
  // A refused write after joining means access ended (new link, game ended, switch off), not a bad connection.
  const fail = (what) => (err) => (err?.code === "permission-denied" ? setStage("dead") : setNotice(what));

  if (court) {
    const singles = court.teamA?.length === 1 && court.teamB?.length === 1;
    return (
      <Page>
        <div className="umpire-bar">
          <b>{court.name || `Court ${court.courtNumber}`}</b>
          <button className="outline" onClick={() => releaseCourt(target.base, court.id).catch(fail("Couldn't release the court. Try again."))}>Release court</button>
        </div>
        {notice && <p className="umpire-note" role="alert">{notice}</p>}
        <ScoreKeeper court={court} players={players} settings={{ style: settings.style, to: settings.to, singles }}
          onScore={(score) => writeScore(target.base, court.id, score).catch(fail("Couldn't save the score. Check your connection."))} />
      </Page>
    );
  }

  return (
    <Page>
      <p className="umpire-note">Pick the court you will score.</p>
      {notice && <p className="umpire-note" role="alert">{notice}</p>}
      {!sorted.length && <p className="umpire-note">No courts yet.</p>}
      <div className="umpire-courts-list">
        {sorted.map((c) => {
          const holder = claims.find((x) => x.id === c.id);
          return (
            <div className="umpire-court" key={c.id}>
              <div>
                <b>{c.name || `Court ${c.courtNumber}`}</b>
                <span>{namesOf(c.teamA, players)} vs {namesOf(c.teamB, players)}</span>
              </div>
              {holder
                ? <small>Taken by {holder.name}</small>
                : <button className="primary" onClick={() => {
                  setNotice("");
                  claimCourt(target.base, c.id, uid, regName).catch(() => setNotice("Someone else just took that court."));
                }}>Claim</button>}
            </div>
          );
        })}
      </div>
    </Page>
  );
}
