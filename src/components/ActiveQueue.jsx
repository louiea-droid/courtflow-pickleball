import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { docsOf } from "../hooks/useLiveDocs";
import { queueStatus } from "../utils/queueStatus";
import { normalizeMode } from "../data/constants";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Track the signed-in person's live games so the same result powers Home and the global header: games they
// are queued in (with a `status`), and games they run as owner or manager (no `status`, `host: true`).
// Home only shows the first kind; the header's Back to game button follows either.
export function useActiveGames(uid, clubs) {
  const [games, setGames] = useState([]);
  const clubsKey = JSON.stringify(clubs.map(({ id, clubName, role }) => [id, clubName, role]));

  useEffect(() => {
    const watchedClubs = JSON.parse(clubsKey);
    setGames([]);
    if (!uid || !firebaseConfigured || !watchedClubs.length) return undefined;

    const liveGames = new Map();
    const eventStops = new Map();
    const clubEvents = new Map();
    const stopAll = [];
    const publish = () => {
      const next = [];
      watchedClubs.forEach(([clubId, clubName, role]) => {
        (clubEvents.get(clubId) || []).forEach((eventId) => {
          const game = liveGames.get(`${clubId}/${eventId}`);
          if (!game) return;
          const status = queueStatus({ players: game.players, courts: game.courts, uid, format: game.event.format, mode: normalizeMode(game.event.mode) || "Balanced", now: Date.now() });
          const hosts = role === "owner" || role === "manager";
          if (!status && !hosts) return;
          const mine = game.players.find((p) => p.uid === uid && p.checked);
          const clubPath = `/clubs/${encodeURIComponent(clubId)}/event/${encodeURIComponent(eventId)}`;
          next.push({
            club: { id: clubId, clubName },
            event: game.event,
            ...(status ? { status, games: mine?.games || 0 } : { host: true }),
            gamePath: `${clubPath}/game`,
            queuePath: `${clubPath}/queue`,
          });
        });
      });
      setGames(next);
    };
    const removeEvent = (clubId, eventId) => {
      const key = `${clubId}/${eventId}`;
      eventStops.get(key)?.forEach((stop) => stop());
      eventStops.delete(key);
      liveGames.delete(key);
    };

    watchedClubs.forEach(([clubId, clubName]) => {
      const stopClub = onSnapshot(
        query(collection(db, "clubs", clubId, "events"), where("status", "==", "live")),
        (snapshot) => {
          const events = docsOf(snapshot);
          const nextIds = events.map((event) => event.id);
          (clubEvents.get(clubId) || []).filter((id) => !nextIds.includes(id)).forEach((id) => removeEvent(clubId, id));
          clubEvents.set(clubId, nextIds);

          events.forEach((event) => {
            const key = `${clubId}/${event.id}`;
            const existing = liveGames.get(key);
            if (existing) {
              existing.event = event;
              return;
            }

            liveGames.set(key, { event, players: [], courts: [] });
            const setCollection = (field, path) => onSnapshot(
              collection(db, "clubs", clubId, "events", event.id, path),
              (s) => {
                const current = liveGames.get(key);
                if (!current) return;
                current[field] = docsOf(s);
                publish();
              },
              () => {
                const current = liveGames.get(key);
                if (!current) return;
                current[field] = [];
                publish();
              },
            );
            eventStops.set(key, [
              setCollection("players", "players"),
              setCollection("courts", "courts"),
            ]);
          });
          publish();
        },
        () => {
          (clubEvents.get(clubId) || []).forEach((id) => removeEvent(clubId, id));
          clubEvents.set(clubId, []);
          publish();
        },
      );
      stopAll.push(stopClub);
    });

    return () => {
      stopAll.forEach((stop) => stop());
      eventStops.forEach((stops) => stops.forEach((stop) => stop()));
    };
  }, [uid, clubsKey]);

  return games;
}

// Home's "Your game": one ticket per live game you're queued in. The left side says where you stand in big
// type; the right stub names the court and opens the queue.
export default function ActiveQueue({ games, navigate }) {
  return games.map(({ club, event, status, queuePath }) => {
    const playing = status.state === "playing";
    const big = playing ? `On court ${status.court}` : status.upNext ? "You're up next" : status.nextOn ? "Next on court" : `#${status.position} in line`;
    const sub = playing ? "Playing now. Good luck!"
      : status.upNext ? (status.nextOn ? `On court ${status.nextOn} when it frees up` : "Get ready")
        : status.nextOn ? `About ${status.waitMins} min`
          : `${plural(status.ahead, "player")} ahead · about ${status.waitMins} min`;
    const court = playing ? status.court : status.nextOn;
    const ahead = !playing && !status.upNext && !status.nextOn ? Math.min(status.ahead, 4) : 0;
    return (
      <article className="queue-card" key={`${club.id}/${event.id}`}>
        <div className="queue-card-main">
          <p className="queue-card-club"><i aria-hidden="true" />{club.clubName} · {event.title || "Open play"} · {playing ? "Playing now" : "Queue is active"}</p>
          <p className="queue-card-big">{big}</p>
          <p className="queue-card-line">{sub}</p>
          {ahead > 0 && (
            <span className="queue-dots" aria-hidden="true">
              {Array.from({ length: ahead }, (_, i) => <i key={i} />)}<i className="me" /><i /><i />
            </span>
          )}
        </div>
        <div className="queue-card-stub">
          {court ? <><small>{playing ? "Your court" : "Next court"}</small><b>Court {court}</b></> : <small>Your place updates live</small>}
          <a className="outline" href={queuePath} onClick={(e) => { e.preventDefault(); navigate(queuePath); }}>View queue</a>
        </div>
      </article>
    );
  });
}
