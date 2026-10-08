import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { docsOf, useDocs } from "../hooks/useLiveDocs";
import { queueStatus } from "../utils/queueStatus";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// One live game: shows a card only when this person is a checked-in player in it.
function EventQueueCard({ uid, club, event, navigate }) {
  const base = ["clubs", club.id, "events", event.id];
  const players = useDocs([...base, "players"]);
  const courts = useDocs([...base, "courts"]);
  const status = queueStatus({ players, courts, uid, format: event.format });
  if (!status) return null;
  const to = `/clubs/${encodeURIComponent(club.id)}/event/${encodeURIComponent(event.id)}/queue`;
  return (
    <article className="queue-card">
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
      <a className="outline" href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>View queue</a>
    </article>
  );
}

// A club's live games (one single-field query, no index).
function ClubLive({ uid, club, navigate }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    setEvents([]);
    if (!firebaseConfigured) return undefined;
    return onSnapshot(
      query(collection(db, "clubs", club.id, "events"), where("status", "==", "live")),
      (s) => setEvents(docsOf(s)),
      () => setEvents([]),
    );
  }, [club.id]);
  return events.map((e) => <EventQueueCard key={e.id} uid={uid} club={club} event={e} navigate={navigate} />);
}

// Cards for every live game the person is waiting in or playing in, across their clubs. Renders nothing
// when there are none (the section around it hides itself, see .home-active).
export default function ActiveQueue({ uid, clubs, navigate }) {
  return clubs.map((c) => <ClubLive key={c.id} uid={uid} club={c} navigate={navigate} />);
}
