import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { CalendarDays, Check, Clock, Wallet } from "lucide-react";
import { db, firebaseConfigured } from "./firebase";
import { useBookings } from "./hooks/useBookings";
import { applyDisplayPrefs, formatDay, formatHM, money } from "./utils/format";
import { applyTheme } from "./utils/theme";
import { byStart, endHM, hasEnded, myStatus, nowIn, splitAttendees } from "./utils/bookings";
import { DEFAULT_DISPLAY, seedSession } from "./data/constants";

// The player's own requests live on their device: the request id is the only
// key to read it back (rules allow a single get, never a list).
const storeKey = (clubId) => `cf-openplay-${clubId}`;
function loadMine(clubId) {
  try { return JSON.parse(localStorage.getItem(storeKey(clubId))) || []; } catch { return []; }
}

function useMyRequests(clubId, mine) {
  const [status, setStatus] = useState({});
  const ids = mine.map((m) => m.rid).join(",");
  useEffect(() => {
    if (!firebaseConfigured || !ids) return;
    const unsubs = ids.split(",").map((rid) => onSnapshot(
      doc(db, "sessions", clubId, "bookingRequests", rid),
      (s) => setStatus((cur) => ({ ...cur, [rid]: s.exists() ? s.data().status : "gone" })),
      () => {},
    ));
    return () => unsubs.forEach((u) => u());
  }, [clubId, ids]);
  return status;
}

function JoinForm({ booking, onSent, onCancel, clubId }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paid = booking.fee > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const rid = crypto.randomUUID();
    try {
      await setDoc(doc(db, "sessions", clubId, "bookingRequests", rid), {
        bookingId: booking.id, name: name.trim(), contact: contact.trim(),
        method: paid ? method : "cash",
        ...(paid && method === "online" && ref.trim() ? { ref: ref.trim() } : {}),
        status: "pending", createdAt: Date.now(),
      });
      onSent({ rid, bookingId: booking.id });
    } catch {
      setError("Couldn't send your request. Check your connection and try again.");
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
          <legend>How will you pay {money(booking.fee)}?</legend>
          <label className="check">
            <input type="radio" name={`pay-${booking.id}`} checked={method === "cash"} onChange={() => setMethod("cash")} />
            Cash at the venue
          </label>
          <label className="check">
            <input type="radio" name={`pay-${booking.id}`} checked={method === "online"} onChange={() => setMethod("online")} />
            Online in advance
          </label>
          {method === "online" && (
            <>
              {booking.payInfo && <p className="op-payinfo">{booking.payInfo}</p>}
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

function EventCard({ b, clubId, mine, onSent }) {
  const [joining, setJoining] = useState(false);
  const { confirmed, waitlist } = splitAttendees(b);
  const left = Math.max(0, b.maxPlayers - confirmed.length);
  const asked = mine.some((m) => m.bookingId === b.id);
  const [wd, rest] = formatDay(b.date).split(", ");

  return (
    <article className="op-card">
      <div className="op-card-top">
        <span className="date-tile" aria-hidden="true"><small>{wd}</small><b>{rest.split(" ")[1]}</b><small>{rest.split(" ")[0]}</small></span>
        <div className="op-card-title">
          <h3>{b.title}</h3>
          <p><CalendarDays size={13} /> {formatDay(b.date)}</p>
          <p><Clock size={13} /> {formatHM(b.startTime)} – {formatHM(endHM(b))}</p>
        </div>
      </div>

      <div className="op-facts">
        <span className="pill">{b.fee > 0 ? money(b.fee) : "Free"}</span>
        {b.level && b.level !== "Any Level" && <span className="pill off">{b.level}</span>}
        <span className={`pill ${left ? "off" : ""}`}>
          {left ? `${left} of ${b.maxPlayers} spots left` : waitlist.length ? `Full · ${waitlist.length} waiting` : "Full"}
        </span>
      </div>
      <div className="bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (confirmed.length / b.maxPlayers) * 100)}%` }} /></div>

      {b.notes && <p className="op-notes">{b.notes}</p>}

      {joining ? (
        <JoinForm booking={b} clubId={clubId} onCancel={() => setJoining(false)} onSent={(m) => { setJoining(false); onSent(m); }} />
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

function MyBookings({ mine, bookings, status }) {
  const rows = mine.map((m) => {
    const booking = bookings.find((b) => b.id === m.bookingId);
    return { ...m, booking, st: myStatus(booking, m.rid, status[m.rid]) };
  }).filter((r) => status[r.rid] !== undefined || r.booking);
  if (!rows.length) return null;
  return (
    <section className="op-mine" aria-label="Your bookings">
      <h2>Your bookings</h2>
      {rows.map((r) => (
        <div className={`op-status ${STATUS_TONE[r.st.key]}`} key={r.rid}>
          <div>
            <b>{r.booking?.title || "Open play"}</b>
            {r.booking && <small>{formatDay(r.booking.date)} · {formatHM(r.booking.startTime)}</small>}
          </div>
          <div className="op-status-end">
            <span>{r.st.label}</span>
            {r.st.paid && r.booking?.fee > 0 && <small>{PAID_LABEL[r.st.paid]}</small>}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function OpenPlay() {
  const clubId = new URLSearchParams(window.location.search).get("club");
  const [session, setSession] = useState(null);
  const bookings = useBookings(clubId);
  const [mine, setMine] = useState(() => (clubId ? loadMine(clubId) : []));
  const status = useMyRequests(clubId, mine);

  useEffect(() => {
    if (!firebaseConfigured || !clubId) return;
    return onSnapshot(doc(db, "sessions", clubId), (s) => setSession(s.exists() ? s.data() : false));
  }, [clubId]);

  useEffect(() => {
    document.title = session?.location ? `${session.location} — Open play` : "Open play";
  }, [session]);

  const display = { ...DEFAULT_DISPLAY, ...(session || seedSession).display };
  applyDisplayPrefs(display);
  // Not before the club loads: defaults would flash Light over the cached theme.
  if (session) applyTheme(display);
  const now = nowIn(display.timeZone);
  const upcoming = useMemo(
    () => bookings.filter((b) => !hasEnded(b, now)).sort(byStart),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookings, now.date, now.hm],
  );

  if (!firebaseConfigured) return <div className="loading">Open play is unavailable — Firebase isn't configured.</div>;
  if (!clubId) return <div className="loading">No club specified. Ask the club for their open play link.</div>;
  if (session === null) return <div className="loading"><span className="spinner" />Loading open play…</div>;
  if (session === false) return <div className="loading">We couldn't find that club. Check the link with the host.</div>;

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
          <p>{session.location}</p>
          <h1>Open play</h1>
        </div>
      </header>

      <MyBookings mine={mine} bookings={bookings} status={status} />

      <section aria-label="Upcoming open play">
        <h2>Upcoming</h2>
        {upcoming.map((b) => <EventCard key={b.id} b={b} clubId={clubId} mine={mine.filter((m) => status[m.rid] !== "declined")} onSent={sent} />)}
        {!upcoming.length && (
          <div className="empty op-empty"><Wallet size={18} /> No open play scheduled right now. Check back soon.</div>
        )}
      </section>
    </div>
  );
}
