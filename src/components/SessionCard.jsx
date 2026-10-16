import { Clock, MapPin } from "lucide-react";
import DateTile from "./DateTile";
import { endHM } from "../utils/bookings";
import { formatDay, formatHM, money } from "../utils/format";
import { spotsLabel } from "../utils/sessions";

// One open-play session of a public club. It links to the club's public booking page (/open-play), where anyone can send a
// booking request; that page is its own screen, so this is a normal link (a full page load), not an in-app navigation.
// Home passes `href` / `onClick` to open the session itself instead (see Hub).
export default function SessionCard({ session: s, mine, compact = false, href, onClick }) {
  const to = href || `/open-play?club=${encodeURIComponent(s.clubId)}`;
  const full = spotsLabel(s).startsWith("Full");
  return (
    <a className={`session-card${compact ? " home-session-card" : ""}`} href={to} onClick={onClick}>
      {compact ? <span className="session-date"><DateTile date={s.date} /></span> : <DateTile date={s.date} />}
      <span className="session-main">
        <b>{s.title || "Open play"}<span className="sr-only">, {formatDay(s.date)}</span></b>
        <small className="session-club">
          {s.clubName}
          {mine && <span className="pill">Your club</span>}
          {s.status === "live" && <span className="pill live">Live now</span>}
        </small>
        <small><Clock size={12} /> {formatHM(s.startTime)} to {formatHM(endHM(s))}{s.clubLocation && <> · <MapPin size={12} /> {s.clubLocation}</>}</small>
      </span>
      <span className="session-side">
        <b className={full ? "session-full" : undefined}>{spotsLabel(s)}</b>
        <small>{s.fee ? money(s.fee) : "Free"}{s.level && s.level !== "Any Level" ? ` · ${s.level}` : ""}</small>
      </span>
    </a>
  );
}
