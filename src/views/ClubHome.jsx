import { CalendarPlus, ChevronRight, Share2 } from "lucide-react";
import DateTile from "../components/DateTile";
import Wave from "../components/Wave";
import { useMembers } from "../hooks/useMembership";
import { fillLine, monthStats, overviewGames } from "../utils/clubOverview";
import { splitAttendees } from "../utils/bookings";
import { feedOrder, isNew } from "../utils/feed";
import { formatDate } from "../utils/format";
import { dayHeading } from "../utils/sessions";
import { LiveCard, timeLine } from "./Host";

const fillPct = (e) => {
  if (e.walkIn || !e.maxPlayers) return 0;
  return Math.min(100, Math.round((splitAttendees(e).confirmed.length / e.maxPlayers) * 100));
};
const bookingUrl = (clubId, eventId) =>
  `/open-play?club=${encodeURIComponent(clubId)}${eventId ? `&event=${encodeURIComponent(eventId)}` : ""}`;

function Stats({ clubId, events, today }) {
  const { members, ready } = useMembers(clubId);
  const { games, players } = monthStats(events, today);
  const month = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { month: "short" });
  return (
    <section className="ov-stats" aria-label="Club numbers">
      <span><b>{ready ? members.length : "–"}</b><small>Members</small></span>
      <span><b>{games}</b><small>Games in {month}</small></span>
      <span><b>{players}</b><small>Players in {month}</small></span>
    </section>
  );
}

function LatestPosts({ feed, onViewFeed }) {
  const posts = feedOrder(feed.posts, feed.pinned, feed.now).slice(0, 3);
  return (
    <section className="panel feed-preview" aria-labelledby="feed-preview-title">
      <div className="panel-row">
        <h2 className="club-section" id="feed-preview-title">Latest posts</h2>
        <button className="club-announcements-more" type="button" onClick={onViewFeed}>View all <ChevronRight size={15} /></button>
      </div>
      {feed.error ? <p className="feed-state" role="status">Couldn&apos;t load the feed.</p>
        : !feed.ready && !posts.length ? <p className="feed-state">Loading…</p>
        : !posts.length ? <p className="feed-state">Nothing posted yet. Be the first on the Feed.</p>
        : posts.map((p) => (
          <article className="feed-preview-item" key={p.id}>
            <div className="feed-preview-head">
              {isNew(p, feed.now) && <span className="ov-new">New</span>}
              <b>{p.authorName}</b> <small>· {formatDate(p.createdAt)}</small>
            </div>
            <p>{p.text}</p>
          </article>
        ))}
    </section>
  );
}

// The club overview: the game in progress or the next game as a hero card, the next few games, and (members) the
// club's numbers and latest posts. The name, role and tabs come from ClubHeader.
export default function ClubHome({
  clubId, club, canManage, isMember, events, fallbackZone, today, base, navigate, onNew, onShareBooking, feed, onViewFeed,
}) {
  const games = overviewGames(events, fallbackZone);
  const { live } = games;
  // While a game is live its card is the hero; the next game then heads the Coming up list.
  const next = live.length ? null : games.next;
  const coming = live.length ? [games.next, ...games.coming].filter(Boolean).slice(0, 3) : games.coming;
  const isPublic = club.visibility === "public";
  const go = (to) => ({ href: to, onClick: (ev) => { ev.preventDefault(); navigate(to); } });
  // Where a game row leads: managers to the event page, members of a public club to the booking page, else nowhere.
  const rowLink = (e) => (canManage ? go(`${base}/event/${e.id}`) : isPublic ? { href: bookingUrl(clubId, e.id) } : null);
  const allLink = canManage ? go(`${base}/host`) : isPublic ? { href: bookingUrl(clubId) } : null;

  return (
    <div className={`ov-layout${isMember ? "" : " solo"}`}>
      <div className="ov-main">
        {live.map((e) => (
          <LiveCard
            key={e.id} e={e} clubId={clubId} open={canManage ? go(`${base}/event/${e.id}`) : null}
            actionLabel={canManage ? "Open game" : "View queue"}
            openGame={isMember ? () => navigate(`${base}/event/${e.id}/${canManage ? "game" : "queue"}`) : null}
          />
        ))}

        {next && (
          <section className="club-next" aria-label="Next game">
            <p className="club-next-kicker">Next game · {dayHeading(next.date, today)}</p>
            <div className="club-next-row">
              <DateTile date={next.date} />
              <div className="club-next-main">
                <h2>{next.title}</h2>
                <small>{timeLine(next)}</small>
              </div>
            </div>
            {!next.walkIn && (
              <div className="club-next-fill">
                <span>{fillLine(next)}</span><b>{fillPct(next)}%</b>
                <span className="club-next-track" aria-hidden="true"><i style={{ width: `${fillPct(next)}%` }} /></span>
              </div>
            )}
            {(canManage || isPublic) && <div className="home-hero-actions">
              {canManage && <a className="home-btn lime" {...go(`${base}/event/${next.id}`)}>Open event <ChevronRight size={16} /></a>}
              {canManage && isPublic && <button className="home-btn ghost" onClick={onShareBooking}><Share2 size={15} /> Share booking link</button>}
              {!canManage && isPublic && <a className="home-btn lime" href={bookingUrl(clubId, next.id)}>Book a spot <ChevronRight size={16} /></a>}
            </div>}
            <Wave />
          </section>
        )}

        {!next && !live.length && (canManage ? (
          <section className="host-empty">
            <h2>No open play <span>yet.</span></h2>
            <p>Schedule a game and share the booking link: players reserve a seat and pay, and you run the queue on the night.</p>
            <div className="home-hero-actions">
              <button className="home-btn lime" onClick={onNew}><CalendarPlus size={16} /> Start new</button>
            </div>
            <Wave />
          </section>
        ) : (
          <div className="panel"><p className="feed-state">No open play scheduled yet.</p></div>
        ))}

        {coming.length > 0 && (
          <section className="panel ov-coming" aria-labelledby="ov-coming-title">
            <div className="panel-row">
              <h2 className="club-section" id="ov-coming-title">Coming up</h2>
              {allLink && <a className="club-announcements-more" {...allLink}>All open play <ChevronRight size={15} /></a>}
            </div>
            {coming.map((e) => {
              const body = (
                <>
                  <DateTile date={e.date} />
                  <span className="ov-row-main"><b>{e.title}</b><small>{timeLine(e)}</small></span>
                  <span className="ov-row-fill">
                    <small>{fillLine(e)}</small>
                    {!e.walkIn && <span className="host-track" aria-hidden="true"><i style={{ width: `${fillPct(e)}%` }} /></span>}
                  </span>
                </>
              );
              const link = rowLink(e);
              return link ? <a key={e.id} className="ov-row" {...link}>{body}</a> : <div key={e.id} className="ov-row">{body}</div>;
            })}
          </section>
        )}
      </div>

      {isMember && (
        <aside className="ov-side">
          <Stats clubId={clubId} events={events} today={today} />
          <LatestPosts feed={feed} onViewFeed={onViewFeed} />
        </aside>
      )}
    </div>
  );
}
