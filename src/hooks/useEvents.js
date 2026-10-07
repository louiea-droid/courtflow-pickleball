import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// Every event of a host, soonest first. Events are public to read, so the public
// booking page uses this too. `ready` flips once the first snapshot (or error) lands.
export function useEvents(uid) {
  const [state, setState] = useState({ events: [], ready: false });
  useEffect(() => {
    setState({ events: [], ready: false });
    if (!firebaseConfigured || !uid) return;
    return onSnapshot(
      query(collection(db, "accounts", uid, "events"), orderBy("date")),
      (s) => setState({ events: s.docs.map((d) => ({ id: d.id, ...d.data() })), ready: true }),
      () => setState({ events: [], ready: true }),
    );
  }, [uid]);
  return state;
}

// Join requests per event, as { [eventId]: request[] }. Only the host can list them.
// One listener per event id; pass only the events whose requests are on screen.
export function useEventRequests(uid, eventIds) {
  const [byEvent, setByEvent] = useState({});
  const key = eventIds.join(",");
  useEffect(() => {
    setByEvent({});
    if (!firebaseConfigured || !uid || !key) return;
    const unsubs = key.split(",").map((eid) => onSnapshot(
      query(collection(db, "accounts", uid, "events", eid, "requests"), orderBy("createdAt")),
      (s) => setByEvent((cur) => ({ ...cur, [eid]: s.docs.map((d) => ({ id: d.id, ...d.data() })) })),
      () => {},
    ));
    return () => unsubs.forEach((u) => u());
  }, [uid, key]);
  return byEvent;
}
