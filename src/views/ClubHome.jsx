import { CalendarDays, MapPin, Settings as SettingsIcon } from "lucide-react";
import DateTile from "../components/DateTile";
import { byStart, endHM, isListed } from "../utils/bookings";
import { formatHM, money } from "../utils/format";

const ROLE_LABEL = { owner: "Owner", manager: "Manager", member: "Member" };

// The club page: what the club is and its upcoming open play. Managers also get links into the
// management screens (the same links are in the club header).
export default function ClubHome({ club, role, canManage, events, fallbackZone, base, navigate }) {
  const upcoming = events.filter((e) => isListed(e, fallbackZone)).sort(byStart);
  const go = (to) => (ev) => { ev.preventDefault(); navigate(to); };
  return (
    <>
      <div className="club-title">
        <h1>{club.name}</h1>
        <div className="club-meta">
          {role && <span className="pill">{ROLE_LABEL[role]}</span>}
          <span className="pill off">{club.visibility === "public" ? "Public club" : "Private club"}</span>
          {club.location && <span className="club-location"><MapPin size={13} /> {club.location}</span>}
        </div>
        {club.description && <p className="club-about">{club.description}</p>}
      </div>

      {canManage && (
        <div className="club-actions">
          <a className="primary" href={`${base}/host`} onClick={go(`${base}/host`)}><CalendarDays size={15} /> Open play</a>
          <a className="outline" href={`${base}/settings`} onClick={go(`${base}/settings`)}><SettingsIcon size={15} /> Settings</a>
        </div>
      )}

      <div className="panel">
        <h3 className="club-section">Upcoming open play</h3>
        {upcoming.map((e) => {
          const row = (
            <>
              <DateTile date={e.date} />
              <div className="booking-main">
                <b>{e.title}</b>
                <small>
                  {formatHM(e.startTime)} – {formatHM(endHM(e))}
                  {e.level && e.level !== "Any Level" ? ` · ${e.level}` : ""}
                  {e.fee ? ` · ${money(e.fee)}` : " · Free"}
                </small>
              </div>
            </>
          );
          return canManage ? (
            <a key={e.id} className="booking-head event-row" href={`${base}/event/${e.id}`} onClick={go(`${base}/event/${e.id}`)}>{row}</a>
          ) : (
            <div key={e.id} className="booking-head">{row}</div>
          );
        })}
        {!upcoming.length && <div className="empty">No open play scheduled yet.</div>}
      </div>
    </>
  );
}
