import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { Check, Clock, MapPin, Wallet } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, firebaseConfigured } from "./firebase";
import { useEvents } from "./hooks/useEvents";
import { applyDisplayPrefs, formatDay, formatHM, money } from "./utils/format";
import { applyGlobalTheme } from "./utils/theme";
import DateTile from "./components/DateTile";
import { byStart, endHM, isListed, myStatus, splitAttendees } from "./utils/bookings";
import { DEFAULT_DISPLAY } from "./data/constants";
import { isAccountUser } from "./utils/account";
import { liveChips } from "./utils/liveBoard";

import { docsOf } from "./hooks/useLiveDocs";
import { bookingCopy } from "./utils/myBookings";
import ClubBadge from "./components/ClubBadge";
import JoinForm, { loadMine, saveMine } from "./components/JoinForm";

const requestRef = (clubId, m) => doc(db, "clubs", clubId, "events", m.eventId, "requests", m.rid);

// Each request as read: its data, or "gone" once deleted. `status` is what the page shows.
function useMyRequests(clubId, mine) {
  const [reqs, setReqs] = useState({});
  const key = mine.map((m) => `${m.eventId}/${m.rid}`).join(",");
  useEffect(() => {
    if (!firebaseConfigured || !key) return;
    const unsubs = mine.map((m) => onSnapshot(
      requestRef(clubId, m),
      (s) => setReqs((cur) => ({ ...cur, [m.rid]: s.exists() ? s.data() : "gone" })),
      () => {},
    ));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, key]);
  const status = useMemo(() => Object.fromEntries(Object.entries(reqs).map(([rid, r]) => [rid, r === "gone" ? "gone" : r.status])), [reqs]);
  return { status, reqs };
}

// Signed in with an account: this club's bookings saved on it (made on any device) show here too, and every booking
// this browser made is linked to the account: a copy on the account (Home and the bell read it) and the account id
// on the request (so "Proceed to game" can link the player and Home shows their place in the queue).
function useAccountBookings(clubId) {
  const [uid, setUid] = useState(null);
  const [saved, setSaved] = useState(null); // null until read
  useEffect(() => (firebaseConfigured ? onAuthStateChanged(auth, (u) => setUid(isAccountUser(u) ? u.uid : null)) : undefined), []);
  useEffect(() => {
    setSaved(null);
    if (!uid || !clubId) return;
    return onSnapshot(query(collection(db, "accounts", uid, "bookings"), where("clubId", "==", clubId)),
      (s) => setSaved(s.docs.map((d) => ({ rid: d.id, seatId: d.data().seatId, eventId: d.data().eventId }))), () => setSaved(null));
  }, [uid, clubId]);
  return { uid, saved };
}

function useLinkBookings({ uid, saved, clubId, clubName, mine, events, reqs }) {
  const tried = useRef(new Set()); // one try per request and account: a refused write isn't sent again on every update
  useEffect(() => {
    if (!uid || !saved) return;
    const known = new Set(saved.map((s) => s.rid));
    mine.forEach((m) => {
      const event = events.find((e) => e.id === m.eventId);
      const req = reqs[m.rid];
      if (!event || !req || req === "gone" || (req.uid && req.uid !== uid)) return; // someone else's, on a shared device
      if (!known.has(m.rid)) {
        setDoc(doc(db, "accounts", uid, "bookings", m.rid), bookingCopy({ clubId, clubName, event, seatId: m.seatId, at: req.createdAt || Date.now() })).catch(() => {});
      }
      if (!req.uid && !tried.current.has(`${uid}/${m.rid}`)) {
        tried.current.add(`${uid}/${m.rid}`);
        updateDoc(requestRef(clubId, m), { uid }).catch(() => {});
      }
    });
  }, [uid, saved, clubId, clubName, mine, events, reqs]);
}

// A game in progress: one chip per scored court ("Court 1  7 - 5" in team colors), live. A public club's court docs are
// readable by anyone; they hold player ids and scores, never names.
function LiveStrip({ clubId, eventId }) {
  const [courts, setCourts] = useState([]);
  useEffect(() => onSnapshot(collection(db, "clubs", clubId, "events", eventId, "courts"),
    (s) => setCourts(docsOf(s)), () => setCourts([])), [clubId, eventId]);
  const chips = liveChips(courts);
  return (
    <div className="op-live" aria-live="polite">
      <span className="op-live-tag"><i aria-hidden="true" /> Live now</span>
      {chips.length ? chips.map((c) => (
        <span className="op-live-chip" key={c.id}>
          <small>{c.name}</small> <b className="t1">{c.t1}</b><em>-</em><b className="t2">{c.t2}</b>
        </span>
      )) : <span className="op-live-none">Game in progress</span>}
    </div>
  );
}

function EventCard({ e, clubId, mine, autoOpen = false, onSent }) {
  const asked = mine.some((m) => m.eventId === e.id);
  const [joining, setJoining] = useState(autoOpen && !asked);
  const { confirmed, waitlist } = splitAttendees(e);
  const left = Math.max(0, e.maxPlayers - confirmed.length);
  const pct = Math.min(100, Math.round((confirmed.length / e.maxPlayers) * 100));

  return (
    <article className={`op-card${e.status === "live" ? " live" : ""}`}>
      <div className="op-card-top">
        <DateTile date={e.date} />
        <div className="op-card-title">
          <h3>{e.title}<span className="sr-only">, {formatDay(e.date)}</span></h3>
          <p><Clock size={13} /> {formatHM(e.startTime)} – {formatHM(endHM(e))}</p>
        </div>
      </div>

      {e.status === "live" && <LiveStrip clubId={clubId} eventId={e.id} />}

      <div className="op-facts">
        <span className="pill">{e.fee > 0 ? money(e.fee) : "Free"}</span>
        {e.level && e.level !== "Any Level" && <span className="pill off">{e.level}</span>}
      </div>
      <p className="op-fill"><span>{left ? `${left} of ${e.maxPlayers} spots left` : "Full"}</span><span>{left ? `${pct}%` : waitlist.length ? `${waitlist.length} waiting` : ""}</span></p>
      <div className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>

      {e.notes && <p className="op-notes">{e.notes}</p>}

      {joining ? (
        <JoinForm event={e} clubId={clubId} autoOpen={autoOpen} onCancel={() => setJoining(false)} onSent={(m) => { setJoining(false); onSent(m); }} />
      ) : asked ? (
        <p className="op-asked"><Check size={14} /> You've asked to join. See your status above.</p>
      ) : (
        <button className={`primary op-join${left ? "" : " wait"}`} onClick={() => setJoining(true)}>
          {left ? "Join this open play" : "Join the waitlist"}
        </button>
      )}
    </article>
  );
}

const STATUS_TONE = { confirmed: "ok", waitlist: "warn", pending: "info", declined: "bad", gone: "bad" };
const PAID_LABEL = { paid: "Payment received", refunded: "Refunded", unpaid: "Payment not yet received" };

function MyBookings({ mine, events, status }) {
  const rows = mine.map((m) => {
    const event = events.find((e) => e.id === m.eventId);
    return { ...m, event, st: myStatus(event, m.seatId, status[m.rid]) };
  }).filter((r) => status[r.rid] !== undefined || r.event);
  if (!rows.length) return null;
  return (
    <section className="op-mine" aria-label="Your bookings">
      <h2>Your bookings</h2>
      {rows.map((r) => (
        <div className={`op-status ${STATUS_TONE[r.st.key]}`} key={r.rid}>
          <div>
            <b>{r.event?.title || "Open play"}</b>
            {r.event && <small>{formatDay(r.event.date)} · {formatHM(r.event.startTime)}</small>}
          </div>
          <div className="op-status-end">
            <span>{r.st.label}</span>
            {r.st.paid && r.event?.fee > 0 && <small>{PAID_LABEL[r.st.paid]}</small>}
          </div>
        </div>
      ))}
    </section>
  );
}

// Under the games, never above them: a way into CourtWave for people who came from a QR code.
// Sign-in links carry ?next= so they land back here (AccountApp). Signed in: just open the club.
function CourtWavePromo({ clubId, clubName }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (u) => setSignedIn(isAccountUser(u))), []);
  const club = clubName || "this club";
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  if (signedIn) {
    return (
      <aside className="op-promo is-in">
        <p>Join {club} in CourtWave to see your place in the queue and chat with the club.</p>
        <a className="op-promo-main" href={`/clubs/${encodeURIComponent(clubId)}`}>Open {club}</a>
      </aside>
    );
  }
  return (
    <aside className="op-promo" aria-labelledby="op-promo-title">
      <h2 id="op-promo-title">Play here often? Join {club} on CourtWave</h2>
      <ul>
        <li><Check size={15} aria-hidden="true" /> See your place in the queue while a game is on</li>
        <li><Check size={15} aria-hidden="true" /> Chat with the club and the players you meet</li>
        <li><Check size={15} aria-hidden="true" /> Find open play at other clubs too</li>
      </ul>
      <div className="op-promo-actions">
        <a className="op-promo-main" href={`/signup?next=${next}`}>Create free account</a>
        <a className="op-promo-explore" href="/">Explore CourtWave</a>
      </div>
      <p className="op-promo-login">Already have an account? <a href={`/signin?next=${next}`}>Log in</a></p>
      <p className="op-promo-note">It's free for players. You come back to this page after signing in.</p>
    </aside>
  );
}

export default function OpenPlay() {
  const params = new URLSearchParams(window.location.search);
  const clubId = params.get("club");
  const wanted = params.get("event"); // a link to one game opens its form
  // Only public clubs have a public booking page. Anything else (a private club, a deleted one,
  // a made-up id) gets one calm message.
  const [access, setAccess] = useState("checking");
  const [club, setClub] = useState(null);
  useEffect(() => {
    if (!firebaseConfigured || !clubId) return;
    getDoc(doc(db, "clubs", clubId)).then(
      (s) => {
        const open = s.exists() && s.data().visibility === "public";
        setClub(open ? s.data() : null);
        setAccess(open ? "open" : "closed");
      },
      () => setAccess("closed"),
    );
  }, [clubId]);
  const { events, ready } = useEvents(access === "open" ? clubId : null);
  const [local, setMine] = useState(() => (clubId ? loadMine(clubId) : []));
  const { uid, saved } = useAccountBookings(access === "open" ? clubId : null);
  // This browser's bookings plus the ones saved on the account from another device.
  const mine = useMemo(() => {
    const have = new Set(local.map((m) => m.rid));
    return [...local, ...(saved || []).filter((s) => !have.has(s.rid))];
  }, [local, saved]);
  const { status, reqs } = useMyRequests(clubId, mine);
  // A request holds the player's place only while it is waiting, confirmed or on the waitlist;
  // once declined, or removed by the host, they may ask again.
  const isActive = (m) => ["pending", "confirmed", "waitlist"].includes(
    myStatus(events.find((e) => e.id === m.eventId), m.seatId, status[m.rid]).key,
  );
  // A page left open drops events as they end.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const hostName = club?.name || events.find((e) => e.hostName)?.hostName || "";
  useLinkBookings({ uid, saved, clubId, clubName: hostName, mine, events, reqs });
  useEffect(() => {
    document.title = hostName ? `${hostName} — Open play` : "Open play";
  }, [hostName]);

  // A public club's theme and time zone apply here (defaults until it loads); each event also
  // carries its own zone for deciding upcoming vs past.
  const display = { ...DEFAULT_DISPLAY, ...club?.display };
  applyDisplayPrefs(display);
  applyGlobalTheme(display, { persist: false });
  const upcoming = useMemo(
    () => events.filter((e) => isListed(e, display.timeZone)).sort(byStart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, tick],
  );

  if (!firebaseConfigured) return <div className="loading">Open play is unavailable — Firebase isn't configured.</div>;
  if (!clubId) return <div className="loading">No club specified. Ask the club for its open play link.</div>;
  if (access === "closed") {
    return <div className="loading">This club's open play isn't public. If you're a member, sign in and open the club page.</div>;
  }
  if (access === "checking" || !ready) return <div className="loading"><span className="spinner" />Loading open play…</div>;

  const sent = (m) => setMine(saveMine(clubId, m, local));

  return (
    <div className="openplay">
      <header className="op-hero">
        <a className="op-logo-link" href="/" aria-label="CourtWave home"><img className="op-logo" src="/images/courtwave-light.png" alt="CourtWave" /></a>
        <div className="op-hero-club">
          <ClubBadge className="op-badge" id={clubId} name={hostName} />
          <div>
            <h1>Open play{hostName && <> at <span>{hostName}</span></>}</h1>
            <p>{club?.location && <><MapPin size={13} /> {club.location} · </>}Pick a game and save your spot</p>
          </div>
        </div>
        <svg className="op-hero-wave" viewBox="0 0 375 44" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 26 C80 8 150 38 230 20 S340 6 375 16 V44 H0Z" fill="var(--lime)" />
          <path d="M0 34 C90 18 160 44 240 30 S350 20 375 26 V44 H0Z" fill="var(--bg)" />
        </svg>
      </header>

      <MyBookings mine={mine} events={events} status={status} />

      <section aria-label="Upcoming open play">
        <h2>Upcoming</h2>
        {upcoming.map((e) => (
          <EventCard key={e.id} e={e} clubId={clubId} mine={mine.filter(isActive)} autoOpen={upcoming.length === 1 || e.id === wanted} onSent={sent} />
        ))}
        {!upcoming.length && (
          <div className="empty op-empty"><Wallet size={18} /> No open play scheduled right now. Check back soon.</div>
        )}
      </section>

      <CourtWavePromo clubId={clubId} clubName={hostName} />
    </div>
  );
}
