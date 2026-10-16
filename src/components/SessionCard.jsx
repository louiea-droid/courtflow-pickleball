import { endHM } from "../utils/bookings";
import { badgeColor, clubInitial } from "../utils/clubs";
import { formatDay, formatHM, money } from "../utils/format";
import { fillRatio, spotsLabel } from "../utils/sessions";

// One open-play session of a public club (Find session). It links to the club's public booking page (/open-play), where
// anyone can send a booking request; that page is its own screen, so this is a normal link (a full page load).
// The day is the group heading above the card, so the card shows the club badge instead of a date.
export default function SessionCard({ session: s, mine, href, onClick }) {
  const to = href || `/open-play?club=${encodeURIComponent(s.clubId)}&event=${encodeURIComponent(s.id)}`;
  const fill = fillRatio(s);
  const live = s.status === "live";
  return (
    <a className={`session-card${live ? " live" : ""}`} href={to} onClick={onClick}>
      <span className="session-badge" style={{ background: badgeColor(s.clubId) }} aria-hidden="true">{clubInitial(s.clubName)}</span>
      <span className="session-main">
        <b>
          {s.title || "Open play"}<span className="sr-only">, {formatDay(s.date)}</span>
          {live && <span className="pill live">Live now</span>}
          {mine && <span className="pill">Your club</span>}
          {s.level && s.level !== "Any Level" && <span className="pill off">{s.level}</span>}
        </b>
        <small>{s.clubName}{s.clubLocation && ` · ${s.clubLocation}`} · {formatHM(s.startTime)} to {formatHM(endHM(s))}</small>
      </span>
      <span className="session-side">
        <b>{s.fee ? money(s.fee) : "Free"}</b>
        <small className={fill === 1 ? "session-full" : undefined}>{spotsLabel(s)}</small>
        {fill !== null && <span className="session-fill" aria-hidden="true"><i style={{ width: `${Math.round(fill * 100)}%` }} /></span>}
      </span>
    </a>
  );
}
