import { CalendarPlus } from "lucide-react";
import DateTile from "../components/DateTile";
import { byStart, endHM, isListed } from "../utils/bookings";
import { formatHM, money } from "../utils/format";
import ClubAnnouncements from "./ClubAnnouncements";

// The club overview: upcoming open play. The club's name, role and tabs come from the club header
// in ClubApp. Managers get one primary action; members just see the list.
export default function ClubHome({
  canManage, isMember, events, fallbackZone, base, navigate, onNew, announcements, announcementsReady, announcementsError, onViewAnnouncements,
}) {
  const upcoming = events.filter((e) => isListed(e, fallbackZone)).sort(byStart);
  const go = (to) => (ev) => { ev.preventDefault(); navigate(to); };
  return (
    <div className="club-home-layout">
      <div className="panel">
        <div className="panel-row">
          <h2 className="club-section">Upcoming open play</h2>
          {canManage && <button className="primary" onClick={onNew}><CalendarPlus size={15} /> Start new</button>}
        </div>
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
        {!upcoming.length && (
          <div className="empty">
            {canManage ? "No open play scheduled. Select Start new to schedule a session." : "No open play scheduled yet."}
          </div>
        )}
      </div>
      {isMember && (
        <ClubAnnouncements
          announcements={announcements.slice(0, 3)} ready={announcementsReady} error={announcementsError}
          canManage={false} preview onViewAll={onViewAnnouncements}
        />
      )}
    </div>
  );
}
