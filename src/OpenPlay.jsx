import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { CalendarDays, Check, Clock, Wallet } from "lucide-react";
import { db, firebaseConfigured } from "./firebase";
import { useEvents } from "./hooks/useEvents";
import { applyDisplayPrefs, formatDay, formatHM, money } from "./utils/format";
import { applyTheme } from "./utils/theme";
import DateTile from "./components/DateTile";
import { byStart, endHM, isListed, myStatus, splitAttendees } from "./utils/bookings";
import { DEFAULT_DISPLAY } from "./data/constants";

// The player's own requests live on their device: the request id is the only key to
// read it back (rules allow a single get, never a list).
const storeKey = (hostId) => `cf-openplay-${hostId}`;
function loadMine(hostId) {
  try {
    // Entries from before seat ids (or from the old club booking page) can't be matched; drop them.
    return (JSON.parse(localStorage.getItem(storeKey(hostId))) || []).filter((m) => m.rid && m.seatId && m.eventId);
  } catch { return []; }
}
const requestRef = (hostId, m) => doc(db, "accounts", hostId, "events", m.eventId, "requests", m.rid);

function useMyRequests(hostId, mine) {
  const [status, setStatus] = useState({});
  const key = mine.map((m) => `${m.eventId}/${m.rid}`).join(",");
  useEffect(() => {
    if (!firebaseConfigured || !key) return;
    const unsubs = mine.map((m) => onSnapshot(
      requestRef(hostId, m),
      (s) => setStatus((cur) => ({ ...cur, [m.rid]: s.exists() ? s.data().status : "gone" })),
      () => {},
    ));
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, key]);
  return status;
}

function JoinForm({ event, hostId, onSent, onCancel }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paid = event.fee > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const rid = crypto.randomUUID();
    const seatId = crypto.randomUUID();
    try {
      await setDoc(doc(db, "accounts", hostId, "events", event.id, "requests", rid), {
        name: name.trim(), contact: contact.trim(),
        method: paid ? method : "cash",
        ...(paid && method === "online" && ref.trim() ? { ref: ref.trim() } : {}),
        seatId, status: "pending", createdAt: Date.now(),
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

function EventCard({ e, hostId, mine, onSent }) {
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
        <JoinForm event={e} hostId={hostId} onCancel={() => setJoining(false)} onSent={(m) => { setJoining(false); onSent(m); }} />
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
  const hostId = new URLSearchParams(window.location.search).get("host");
  const { events, ready } = useEvents(hostId);
  const [mine, setMine] = useState(() => (hostId ? loadMine(hostId) : []));
  const status = useMyRequests(hostId, mine);
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

  const hostName = events.find((e) => e.hostName)?.hostName || "";
  useEffect(() => {
    document.title = hostName ? `${hostName} — Open play` : "Open play";
  }, [hostName]);

  // The host's private account (theme, zone) isn't readable here, so the page uses the
  // defaults; each event carries its own zone for deciding upcoming vs past.
  applyDisplayPrefs(DEFAULT_DISPLAY);
  applyTheme(DEFAULT_DISPLAY, { persist: false });
  const upcoming = useMemo(
    () => events.filter((e) => isListed(e, DEFAULT_DISPLAY.timeZone)).sort(byStart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, tick],
  );

  if (!firebaseConfigured) return <div className="loading">Open play is unavailable — Firebase isn't configured.</div>;
  if (!hostId) return <div className="loading">No host specified. Ask the host for their open play link.</div>;
  if (!ready) return <div className="loading"><span className="spinner" />Loading open play…</div>;

  const sent = (m) => {
    const next = [...mine, m];
    setMine(next);
    try { localStorage.setItem(storeKey(hostId), JSON.stringify(next)); } catch { /* private mode: status just won't persist */ }
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
          <EventCard key={e.id} e={e} hostId={hostId} mine={mine.filter(isActive)} onSent={sent} />
        ))}
        {!upcoming.length && (
          <div className="empty op-empty"><Wallet size={18} /> No open play scheduled right now. Check back soon.</div>
        )}
      </section>
    </div>
  );
}
