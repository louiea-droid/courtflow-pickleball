import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// Every event of a host, soonest first. Events are public to read, so the public
// booking page uses this too. `ready` flips once the first snapshot (or error) lands.
// `fromServer` flips once the server has answered (or after a few seconds, so an offline
// host isn't stuck): until then a missing event may just be one the cache doesn't have yet,
// so screens show Loading instead of "doesn't exist".
export function useEvents(uid) {
  const [state, setState] = useState({ events: [], ready: false, fromServer: false });
  useEffect(() => {
    setState({ events: [], ready: false, fromServer: false });
    if (!firebaseConfigured || !uid) return;
    const settle = setTimeout(() => setState((cur) => ({ ...cur, ready: true, fromServer: true })), 5000);
    const unsub = onSnapshot(
      query(collection(db, "accounts", uid, "events"), orderBy("date")),
      { includeMetadataChanges: true },
      (s) => setState({
        events: s.docs.map((d) => ({ id: d.id, ...d.data() })), ready: true, fromServer: !s.metadata.fromCache,
      }),
      () => setState({ events: [], ready: true, fromServer: true }),
    );
    return () => { clearTimeout(settle); unsub(); };
  }, [uid]);
  return state;
}

// Join requests per event, as { [eventId]: request[] }. Only the host can list them.
// One listener per event id; pass only the events whose requests are on screen. When the
// set changes only the events that came or went are touched, so the others don't reset.
export function useEventRequests(uid, eventIds) {
  const [byEvent, setByEvent] = useState({});
  const subs = useRef(new Map());
  const key = eventIds.join(",");

  useEffect(() => {
    if (!firebaseConfigured || !uid) return;
    const want = new Set(key ? key.split(",") : []);
    for (const [eid, unsub] of subs.current) {
      if (want.has(eid)) continue;
      unsub();
      subs.current.delete(eid);
      setByEvent((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => k !== eid)));
    }
    for (const eid of want) {
      if (subs.current.has(eid)) continue;
      subs.current.set(eid, onSnapshot(
        query(collection(db, "accounts", uid, "events", eid, "requests"), orderBy("createdAt")),
        (s) => setByEvent((cur) => ({ ...cur, [eid]: s.docs.map((d) => ({ id: d.id, ...d.data() })) })),
        () => {},
      ));
    }
  }, [uid, key]);

  // A different account (or leaving the page) drops everything.
  useEffect(() => () => {
    subs.current.forEach((unsub) => unsub());
    subs.current.clear();
    setByEvent({});
  }, [uid]);

  return byEvent;
}
