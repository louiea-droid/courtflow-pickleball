import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { docsOf } from "../hooks/useLiveDocs";
import { queueStatus } from "../utils/queueStatus";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Track the signed-in player's live games so the same result powers Home and the global header.
export function useActiveGames(uid, clubs) {
  const [games, setGames] = useState([]);
  const clubsKey = JSON.stringify(clubs.map(({ id, clubName }) => [id, clubName]));

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
      watchedClubs.forEach(([clubId, clubName]) => {
        (clubEvents.get(clubId) || []).forEach((eventId) => {
          const game = liveGames.get(`${clubId}/${eventId}`);
          if (!game) return;
          const status = queueStatus({ players: game.players, courts: game.courts, uid, format: game.event.format });
          if (!status) return;
          const clubPath = `/clubs/${encodeURIComponent(clubId)}/event/${encodeURIComponent(eventId)}`;
          next.push({
            club: { id: clubId, clubName },
            event: game.event,
            status,
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

export default function ActiveQueue({ games, navigate }) {
  return games.map(({ club, event, status, queuePath }) => (
    <article className="queue-card" key={`${club.id}/${event.id}`}>
      <div>
        <p className="queue-card-club">
          {club.clubName}
          <span className="queue-live"><i aria-hidden="true" />{status.state === "playing" ? "Playing now" : "Queue is active"}</span>
        </p>
        <p className="queue-card-line">
          {status.state === "playing" ? <>You're on <b>court {status.court}</b></>
            : status.upNext ? <b>You're up next</b>
              : <><b>You're #{status.position} in line</b> · {plural(status.ahead, "player")} ahead · about {status.waitMins} min</>}
        </p>
      </div>
      <a className="outline" href={queuePath} onClick={(e) => { e.preventDefault(); navigate(queuePath); }}>View queue</a>
    </article>
  ));
}
