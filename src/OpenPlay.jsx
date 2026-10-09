import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { CalendarDays, Check, Clock, Wallet } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, firebaseConfigured } from "./firebase";
import { useEvents } from "./hooks/useEvents";
import { applyDisplayPrefs, formatDay, formatHM, money } from "./utils/format";
import { applyGlobalTheme } from "./utils/theme";
import DateTile from "./components/DateTile";
import { byStart, endHM, isListed, myStatus, splitAttendees } from "./utils/bookings";
import { DEFAULT_DISPLAY } from "./data/constants";
import { isAccountUser } from "./utils/account";

// The player's own requests live on their device: the request id is the only key to
// read it back (rules allow a single get, never a list).
const storeKey = (clubId) => `cf-openplay-${clubId}`;
function loadMine(clubId) {
  try {
    // Entries from before seat ids (or from the old club booking page) can't be matched; drop them.
    return (JSON.parse(localStorage.getItem(storeKey(clubId))) || []).filter((m) => m.rid && m.seatId && m.eventId);
  } catch { return []; }
}
const requestRef = (clubId, m) => doc(db, "clubs", clubId, "events", m.eventId, "requests", m.rid);

function useMyRequests(clubId, mine) {
  const [status, setStatus] = useState({});
  const key = mine.map((m) => `${m.eventId}/${m.rid}`).join(",");
  useEffect(() => {
    if (!firebaseConfigured || !key) return;
    const unsubs = mine.map((m) => onSnapshot(
      requestRef(clubId, m),
      (s) => setStatus((cur) => ({ ...cur, [m.rid]: s.exists() ? s.data().status : "gone" })),
      () => {},
    ));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, key]);
  return status;
}

function JoinForm({ event, clubId, onSent, onCancel }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paid = event.fee > 0;
  // A signed-in account (not a quick session or an old club login) links the booking to the person, so their
  // Home can show their place in the queue. Everyone else books exactly as before.
  const [uid, setUid] = useState(null);
  useEffect(() => (firebaseConfigured ? onAuthStateChanged(auth, (u) => setUid(isAccountUser(u) ? u.uid : null)) : undefined), []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const rid = crypto.randomUUID();
    const seatId = crypto.randomUUID();
    try {
      await setDoc(doc(db, "clubs", clubId, "events", event.id, "requests", rid), {
        name: name.trim(), contact: contact.trim(),
        method: paid ? method : "cash",
        ...(paid && method === "online" && ref.trim() ? { ref: ref.trim() } : {}),
        seatId, status: "pending", createdAt: Date.now(),
        ...(uid ? { uid } : {}),
      });
      onSent({ rid, seatId, eventId: event.id });
    } catch {
      setError("Couldn't send your request. Check your connection and your phone's clock, then try again.");
      setBusy(false);
    }
  };

  return (
    <form className="op-form" onSubmit={submit}>
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" required autoFocus />
      </label>
      <label>
        Mobile number
        <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={40} inputMode="tel" autoComplete="tel" required />
      </label>
      {paid && (
        <fieldset className="op-pay">
          <legend>How will you pay {money(event.fee)}?</legend>
          <label className="check">
            <input type="radio" name={`pay-${event.id}`} checked={method === "cash"} onChange={() => setMethod("cash")} />
            Cash at the venue
          </label>
          <label className="check">
            <input type="radio" name={`pay-${event.id}`} checked={method === "online"} onChange={() => setMethod("online")} />
            Online in advance
          </label>
          {method === "online" && (
            <>
              {event.payInfo && <p className="op-payinfo">{event.payInfo}</p>}
              <label>
                Payment reference number
                <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} placeholder="From your receipt" />
              </label>
            </>
          )}
        </fieldset>
      )}
      {error && <p className="op-error" role="alert">{error}</p>}
      <div className="modalactions">
        <button type="button" className="outline" onClick={onCancel}>Cancel</button>
        <button className="primary" disabled={busy || !name.trim() || !contact.trim()}>
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
      <p className="op-fineprint">The host confirms your spot. Check back on this page to see your status.</p>
    </form>
  );
}

function EventCard({ e, clubId, mine, onSent }) {
  const [joining, setJoining] = useState(false);
  const { confirmed, waitlist } = splitAttendees(e);
  const left = Math.max(0, e.maxPlayers - confirmed.length);
  const asked = mine.some((m) => m.eventId === e.id);

  return (
    <article className="op-card">
      <div className="op-card-top">
        <DateTile date={e.date} />
        <div className="op-card-title">
          <h3>{e.title}</h3>
          <p><CalendarDays size={13} /> {formatDay(e.date)}</p>
          <p><Clock size={13} /> {formatHM(e.startTime)} – {formatHM(endHM(e))}</p>
        </div>
      </div>

      <div className="op-facts">
        <span className="pill">{e.fee > 0 ? money(e.fee) : "Free"}</span>
        {e.level && e.level !== "Any Level" && <span className="pill off">{e.level}</span>}
        <span className={`pill ${left ? "off" : ""}`}>
          {left ? `${left} of ${e.maxPlayers} spots left` : waitlist.length ? `Full · ${waitlist.length} waiting` : "Full"}
        </span>
      </div>
      <div className="bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (confirmed.length / e.maxPlayers) * 100)}%` }} /></div>

      {e.notes && <p className="op-notes">{e.notes}</p>}

      {joining ? (
        <JoinForm event={e} clubId={clubId} onCancel={() => setJoining(false)} onSent={(m) => { setJoining(false); onSent(m); }} />
      ) : asked ? (
        <p className="op-asked"><Check size={14} /> You've asked to join. See your status above.</p>
      ) : (
        <button className="primary op-join" onClick={() => setJoining(true)}>
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

export default function OpenPlay() {
  const clubId = new URLSearchParams(window.location.search).get("club");
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
  const [mine, setMine] = useState(() => (clubId ? loadMine(clubId) : []));
  const status = useMyRequests(clubId, mine);
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

  const sent = (m) => {
    const next = [...mine, m];
    setMine(next);
    try { localStorage.setItem(storeKey(clubId), JSON.stringify(next)); } catch { /* private mode: status just won't persist */ }
  };

  return (
    <div className="openplay">
      <header className="op-header">
        <img className="op-logo" src="/images/courtflow logo.png" alt="" />
        <div>
          {hostName && <p>{hostName}</p>}
          <h1>Open play</h1>
        </div>
      </header>

      <MyBookings mine={mine} events={events} status={status} />

      <section aria-label="Upcoming open play">
        <h2>Upcoming</h2>
        {upcoming.map((e) => (
          <EventCard key={e.id} e={e} clubId={clubId} mine={mine.filter(isActive)} onSent={sent} />
        ))}
        {!upcoming.length && (
          <div className="empty op-empty"><Wallet size={18} /> No open play scheduled right now. Check back soon.</div>
        )}
      </section>
    </div>
  );
}
