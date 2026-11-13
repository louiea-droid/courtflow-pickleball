import { useEffect, useMemo, useState } from "react";
import { Check, UserPlus } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, db } from "./firebase";
import { authMessage } from "./utils/account";
import { docsOf } from "./hooks/useLiveDocs";
import StarDisplay from "./components/StarDisplay";
import { LEVEL_CHOICES, checkinTarget, matchName, needsLevel, validCode } from "./utils/selfCheckin";
import { addSelf, checkInSelf, joinCheckin } from "./utils/checkinData";
import { queueOrder } from "./utils/queueStatus";

// /checkin?club=C&event=E: a player checks themselves in from the Live Board's QR code. No account; the 4-digit code on
// the screen proves they are at the venue. They type their name (never a list of everyone), confirm who they are, and
// only an unrated or new player picks a level (docs/superpowers/specs/2026-11-13-self-checkin-design.md).
function Page({ children }) {
  return <div className="umpire-page checkin-page"><h1>Check in</h1>{children}</div>;
}

export default function Checkin() {
  const target = useMemo(() => checkinTarget(window.location.search), []);
  const [uid, setUid] = useState(null);
  const [authError, setAuthError] = useState("");
  const [step, setStep] = useState("code"); // code | name | match | level | done
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [live, setLive] = useState(false);
  const [players, setPlayers] = useState([]);
  const [courts, setCourts] = useState([]);
  const [name, setName] = useState("");
  const [match, setMatch] = useState(null); // matchName result
  const [who, setWho] = useState(null); // the player being checked in, or { name } for a new one
  const [level, setLevel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [doneId, setDoneId] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (user) { setUid(user.uid); return; }
    signInAnonymously(auth).catch((err) => setAuthError(
      err.code === "auth/operation-not-allowed" || err.code === "auth/admin-restricted-operation"
        ? "Self check-in needs anonymous sign-in turned on for this project. Ask the host." : authMessage(err)));
  }), []);

  // A QR made with "Ask for the code" off carries the code: register straight away.
  useEffect(() => { if (uid && target?.code && step === "code" && !live) { setCode(target.code); submitCode(target.code); } }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Players and courts, live once registered. A refused read: the code changed, check-in was switched off or the game ended.
  useEffect(() => {
    if (!live || !target) return undefined;
    const lost = () => { setLive(false); setStep("code"); setCode(""); setCodeError("The code changed or check-in is closed. Type the code on the screen."); };
    const offs = [
      onSnapshot(collection(db, ...target.base, "players"), (s) => setPlayers(docsOf(s)), lost),
      onSnapshot(collection(db, ...target.base, "courts"), (s) => setCourts(docsOf(s)), lost),
    ];
    return () => offs.forEach((f) => f());
  }, [live]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return <Page><p className="umpire-note">This check-in link is incomplete. Scan the QR code on the screen again.</p></Page>;
  if (authError) return <Page><p className="umpire-note">{authError}</p></Page>;

  const queue = queueOrder(players, courts);
  const placeOf = (id) => queue.findIndex((p) => p.id === id) + 1;
  const fresh = (p) => players.find((x) => x.id === p?.id) || p;

  async function submitCode(value) {
    if (!validCode(value) || !uid) return;
    setBusy(true); setCodeError("");
    try {
      await joinCheckin(target.base, uid, value);
      setLive(true); setStep("name");
    } catch {
      setCodeError(value === target.code
        ? "This QR code is out of date. Scan the one at the venue, or type the code shown there."
        : "That code isn't right. Check the code on the screen (it changes every game).");
    }
    setBusy(false);
  }

  function findMe(e) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    const m = matchName(players, name);
    setMatch(m); setError("");
    if (m.kind === "none" && !m.tooMany) { setWho({ name: name.trim() }); setLevel(null); setStep("level"); return; }
    setStep("match");
  }

  async function confirm(p) {
    const me = fresh(p);
    if (me.checked) { setDoneId(me.id); setWho(me); setStep("done"); return; }
    if (needsLevel(me)) { setWho(me); setLevel(null); setStep("level"); return; }
    await save(me, null);
  }

  async function save(p, stars) {
    setBusy(true); setError("");
    try {
      const id = p.id ? (await checkInSelf(target.base, p.id, stars), p.id) : await addSelf(target.base, p.name, stars);
      setDoneId(id); setWho(p); setStep("done");
    } catch {
      setError("Couldn't check you in. If the code on the screen changed, start again with the new code.");
    }
    setBusy(false);
  }

  const again = () => { setName(""); setMatch(null); setWho(null); setLevel(null); setDoneId(null); setError(""); setStep("name"); };

  if (step === "code") {
    return (
      <Page>
        <p className="umpire-note">Type the 4-digit code shown on the Live Board, next to the QR code. It changes every game.</p>
        <input
          className="checkin-code" inputMode="numeric" autoComplete="one-time-code" maxLength={4} autoFocus aria-label="Check-in code"
          value={code} disabled={busy || !uid}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setCode(v); if (v.length === 4) submitCode(v); }}
        />
        {codeError && <p className="op-error" role="alert">{codeError}</p>}
        {busy && <p className="umpire-note">Checking the code…</p>}
      </Page>
    );
  }

  if (step === "name") {
    return (
      <Page>
        <form className="checkin-card" onSubmit={findMe}>
          <label htmlFor="ci-name"><b>Your name</b></label>
          <input id="ci-name" value={name} maxLength={40} autoFocus autoComplete="name" placeholder="First and last name" onChange={(e) => setName(e.target.value)} />
          <button className="primary" disabled={name.trim().length < 2}>Continue</button>
        </form>
      </Page>
    );
  }

  if (step === "match") {
    const list = match?.players || [];
    return (
      <Page>
        {match?.tooMany ? (
          <p className="umpire-note">Several people fit that. Type your full name.</p>
        ) : (
          <p className="umpire-note">{match?.kind === "suggest" ? "Did you mean…" : match?.kind === "few" ? "Which one are you?" : "Is this you?"}</p>
        )}
        {list.map((p) => (
          <div className="checkin-card checkin-person" key={p.id}>
            <span><b>{p.name}</b>{p.skill ? <StarDisplay value={p.skill} /> : <small>No level yet</small>}</span>
            <button className="primary" disabled={busy} onClick={() => confirm(p)}><Check size={15} /> {list.length > 1 ? "This is me" : "Yes, check in"}</button>
          </div>
        ))}
        {error && <p className="op-error" role="alert">{error}</p>}
        <button className="outline" onClick={() => (match?.tooMany ? again() : (setWho({ name: name.trim() }), setLevel(null), setStep("level")))}>
          <UserPlus size={15} /> {match?.tooMany ? "Type it again" : `No, I'm new (${name.trim()})`}
        </button>
        <button className="linklike" onClick={again}>Change the name</button>
      </Page>
    );
  }

  if (step === "level") {
    return (
      <Page>
        <p className="umpire-note">{who?.id ? <>Welcome back, <b>{who.name}</b>.</> : <>Welcome, <b>{who?.name}</b>! You're new here.</>} Pick the level closest to you; the host may adjust it.</p>
        <div className="checkin-levels" role="radiogroup" aria-label="Your level">
          {LEVEL_CHOICES.map((l) => (
            <button key={l.stars} type="button" role="radio" aria-checked={level === l.stars} className="checkin-level" onClick={() => setLevel(l.stars)}>
              <b>{l.label}</b><StarDisplay value={l.stars} />
            </button>
          ))}
        </div>
        {error && <p className="op-error" role="alert">{error}</p>}
        <button className="primary" disabled={!level || busy} onClick={() => save(who, level)}>{busy ? "Checking in…" : "Join the queue"}</button>
        <button className="linklike" onClick={again}>Back</button>
      </Page>
    );
  }

  // done
  const me = players.find((p) => p.id === doneId);
  const place = me ? placeOf(me.id) : 0;
  const onCourt = me && courts.some((c) => [...(c.teamA || []), ...(c.teamB || [])].includes(me.id));
  return (
    <Page>
      <div className="checkin-done">
        <b>{who?.checked ? "You're already in!" : "You're in!"}</b>
        <span>{me?.name || who?.name}</span>
        <strong>{onCourt ? "On court" : place ? `#${place}` : "…"}</strong>
        <small>{onCourt ? "Playing now. Good luck!" : place ? "in the queue. This updates live." : "Finding your place…"}</small>
      </div>
      <p className="umpire-note">Taking a break or leaving? Tell the host.</p>
      <button className="outline" onClick={again}><UserPlus size={15} /> Check in someone else</button>
    </Page>
  );
}
