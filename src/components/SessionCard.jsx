import { endHM, splitAttendees } from "../utils/bookings";

import { formatDay, formatHM, money } from "../utils/format";
import ClubBadge from "./ClubBadge";

const MAX_DOTS = 24; // one block per spot up to this many; a bigger game gets a plain bar
const dayPart = (ymd, opt) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, { ...opt, timeZone: "UTC" });

// One open-play session of a public club (Find session, 2026-11-17 redesign A): date tile, the time big, the club, price,
// level, one block per spot and a Book button. The whole card is a link to the club's public booking page (/open-play);
// Find session opens it in a pop-up instead (onClick). `booked`: this person already has a booking on it.
export default function SessionCard({ session: s, mine, booked, href, onClick }) {
  const to = href || `/open-play?club=${encodeURIComponent(s.clubId)}&event=${encodeURIComponent(s.id)}`;
  const live = s.status === "live";
  const max = s.maxPlayers || 0;
  const { confirmed, waitlist } = splitAttendees(s);
  const taken = confirmed.length;
  const full = max > 0 && taken >= max;
  const action = booked ? "View your booking" : full ? "Join waitlist" : "Book a spot";
  return (
    <a className={`session-card${live ? " live" : ""}${full ? " full" : ""}`} href={to} onClick={onClick}>
      <span className="session-top">
        <span className="session-tile" aria-hidden="true">
          <small>{dayPart(s.date, { weekday: "short" })}</small><b>{Number(s.date.slice(8))}</b><small>{dayPart(s.date, { month: "short" })}</small>
        </span>
        <span className="session-what">
          {live && <span className="session-live">Live now</span>}
          <b className="session-time">{formatHM(s.startTime)} – {formatHM(endHM(s))}<span className="sr-only">, {formatDay(s.date)}</span></b>
          <span className="session-title">{s.title || "Open play"}</span>
          <span className="session-club">
            <ClubBadge className="session-badge" id={s.clubId} name={s.clubName} photo={s.clubPhoto || ""} />
            <span>{s.clubName}{(s.venue || s.clubLocation) && `, ${s.venue || s.clubLocation}`}</span>
            {mine && <span className="session-mine">Your club</span>}
          </span>
        </span>
        <span className="session-price"><b>{s.fee ? money(s.fee) : "Free"}</b>{s.fee ? <small>per player</small> : null}</span>
      </span>
      {s.level && s.level !== "Any Level" && <span className="session-tags"><span>{s.level}</span></span>}
      <span className="session-seats">
        <span className="session-seatline">
          {!max ? <span>Open, no spot limit</span>
            : full ? <span><b>Full</b>{waitlist.length > 0 && `, ${waitlist.length} waiting`}</span>
              : <span><b>{max - taken} of {max}</b> spots open</span>}
          {max > 0 && <span>{taken === 0 ? "Be the first" : `${taken} booked`}</span>}
        </span>
        {max > 0 && (max <= MAX_DOTS ? (
          <span className="session-dots" aria-hidden="true">{Array.from({ length: max }, (_, i) => <i key={i} className={i < taken ? "on" : undefined} />)}</span>
        ) : (
          <span className="session-fill" aria-hidden="true"><i style={{ width: `${Math.round((taken / max) * 100)}%` }} /></span>
        ))}
      </span>
      <span className={`session-book${full && !booked ? " wait" : ""}`}>{action}</span>
    </a>
  );
}
