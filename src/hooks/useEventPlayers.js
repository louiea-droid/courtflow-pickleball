import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// The players in one event's game: the pick list greys out who is already in, and the
// event page shows a summary. Pass a null eventId to listen to nothing.
export function useEventPlayers(uid, eventId) {
  const [players, setPlayers] = useState([]);
  useEffect(() => {
    setPlayers([]);
    if (!firebaseConfigured || !uid || !eventId) return;
    return onSnapshot(
      collection(db, "accounts", uid, "events", eventId, "players"),
      (s) => setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {},
    );
  }, [uid, eventId]);
  return players;
}
