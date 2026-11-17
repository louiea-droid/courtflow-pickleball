import { useState } from "react";
import { createPortal } from "react-dom";
import { doc, setDoc } from "firebase/firestore";
import { Check, MapPin, X } from "lucide-react";
import { db } from "../firebase";
import { useEscape } from "../hooks/useEscape";
import { endHM, splitAttendees } from "../utils/bookings";
import { badgeColor } from "../utils/clubs";
import { fillLine } from "../utils/clubOverview";
import { formatHM, money } from "../utils/format";
import { fillRatio } from "../utils/sessions";
import { bookingCopy } from "../utils/myBookings";
import ClubBadge from "./ClubBadge";
import DateTile from "./DateTile";
import JoinForm, { saveMine } from "./JoinForm";
import Wave from "./Wave";

const hours = (mins) => (mins % 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins / 60} hour${mins === 60 ? "" : "s"}`);

// "Ann, Bea, Cal and 2 more": the names on the confirmed list (public on the event, like the count).
function goingLine(names) {
  if (!names.length) return "";
  if (names.length <= 3) return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
}

// A game from Find session, as a ticket: details, then booking in two steps without leaving the list.
// `booking` is the person's own booking of this game (from their account), `member` whether they are in the club.
export default function GameTicketModal({ session: s, member, booking, uid, name, onClose, navigate }) {
  useEscape(onClose);
  const [step, setStep] = useState("details"); // details | book | sent
  const { confirmed } = splitAttendees(s);
  const ratio = fillRatio(s);
  const full = ratio === 1;
  const live = s.status === "live";
  const bookingUrl = `/open-play?club=${encodeURIComponent(s.clubId)}&event=${encodeURIComponent(s.id)}`;
  const clubUrl = `/clubs/${encodeURIComponent(s.clubId)}`;
  const going = goingLine(confirmed.map((a) => a.name).filter(Boolean));

  const sent = (m) => {
    saveMine(s.clubId, m);
    // Home and the bell read the account's copy; the booking page would also add it, but only once opened.
    if (uid) setDoc(doc(db, "accounts", uid, "bookings", m.rid), bookingCopy({ clubId: s.clubId, clubName: s.clubName, event: s, seatId: m.seatId, at: Date.now() })).catch(() => {});
    setStep("sent");
  };

  const joinOffer = !member && (
    <div className="sm-join">
      <p><b>Play at {s.clubName} often?</b> Join to see the feed, chat and your place in the queue.</p>
      <a href={clubUrl} onClick={(e) => { e.preventDefault(); onClose(); navigate(clubUrl); }}>Join club</a>
    </div>
  );

  return createPortal(
    <div className="backdrop sm-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sm" role="dialog" aria-modal="true" aria-label={`${s.title || "Open play"}, ${s.clubName}`}>
        <button className="sm-close" onClick={onClose} aria-label="Close"><X size={18} /></button>

        {step === "details" && <>
          <div className="sm-scroll">
            <header className="sm-hero" style={{ "--club": badgeColor(s.clubId) }}>
              <div className="sm-club">
                <ClubBadge className="sm-badge" id={s.clubId} name={s.clubName} photo={s.clubPhoto || ""} />
                <div><b>{s.clubName}</b><small>{s.clubLocation ? `${s.clubLocation} · ` : ""}Public club</small></div>
              </div>
              <div className="sm-title">
                <DateTile date={s.date} />
                <div>
                  <h2>{s.title || "Open play"}</h2>
                  <p>{formatHM(s.startTime)} to {formatHM(endHM(s))}{s.durationMins ? ` · ${hours(s.durationMins)}` : ""}</p>
                </div>
              </div>
              <Wave className="sm-wave" />
            </header>
            <div className="sm-body">
              <div className="sm-chips">
                {live && <span className="sm-chip live">Live now</span>}
                <span className="sm-chip">{s.level && s.level !== "Any Level" ? s.level : "All levels"}</span>
                {s.fee > 0 && <span className="sm-chip">Cash or online</span>}
              </div>
              <p className="sm-fill">{fillLine(s)}</p>
              {ratio !== null && <div className="sm-bar" aria-hidden="true"><i style={{ width: `${Math.round(ratio * 100)}%` }} /></div>}
              {(s.venue || s.clubLocation) && <p className="sm-fact"><MapPin size={16} aria-hidden="true" /> {s.venue || s.clubLocation}</p>}
              {s.notes && <p className="sm-note">{s.notes}</p>}
              {going && <p className="sm-going"><b>Going:</b> {going}</p>}
              {booking && <p className="sm-mine"><Check size={15} aria-hidden="true" /> You booked this game: {booking.status.label}</p>}
              {joinOffer}
            </div>
          </div>
          <footer className="sm-foot">
            <div className="sm-price"><b>{s.fee > 0 ? money(s.fee) : "Free"}</b>{s.fee > 0 && <small>per player</small>}</div>
            {booking
              ? <a className="sm-cta" href={bookingUrl}>View booking</a>
              : <button className="sm-cta" onClick={() => setStep("book")}>{full ? "Join the waitlist" : "Book a spot"}</button>}
          </footer>
        </>}

        {step === "book" && (
          <div className="sm-scroll sm-book">
            <div className="sm-club plain">
              <ClubBadge className="sm-badge" id={s.clubId} name={s.clubName} photo={s.clubPhoto || ""} />
              <div><b>{s.title || "Open play"}</b><small>{formatHM(s.startTime)} to {formatHM(endHM(s))} · {s.clubName}</small></div>
            </div>
            <JoinForm
              event={s} clubId={s.clubId} defaultName={name} onCancel={() => setStep("details")} onSent={sent}
              fineprint="The host confirms your spot. You'll see it on Home and in the bell."
            />
          </div>
        )}

        {step === "sent" && <>
          <div className="sm-scroll">
            <div className="sm-done">
              <span className="sm-ok" aria-hidden="true"><Check size={30} strokeWidth={3} /></span>
              <h2>Request sent</h2>
              <p>The host confirms your spot. You'll see it on Home and in the bell.</p>
            </div>
            <div className="sm-body">{joinOffer}</div>
          </div>
          <footer className="sm-foot">
            <a className="outline" href={bookingUrl}>View booking</a>
            <button className="sm-cta" onClick={onClose}>Done</button>
          </footer>
        </>}
      </div>
    </div>,
    document.body,
  );
}
