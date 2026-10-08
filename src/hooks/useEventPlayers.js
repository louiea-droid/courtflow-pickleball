import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// The players in one event's game: the pick list greys out who is already in, and the
// event page shows a summary once `loaded` (so it never flashes "of 0"). Pass a null
// eventId to listen to nothing.
export function useEventPlayers(clubId, eventId) {
  const [state, setState] = useState({ players: [], loaded: false });
  useEffect(() => {
    setState({ players: [], loaded: false });
    if (!firebaseConfigured || !clubId || !eventId) return;
    return onSnapshot(
      collection(db, "clubs", clubId, "events", eventId, "players"),
      (s) => setState({ players: s.docs.map((d) => ({ id: d.id, ...d.data() })), loaded: true }),
      () => setState({ players: [], loaded: true }),
    );
  }, [clubId, eventId]);
  return state;
}
