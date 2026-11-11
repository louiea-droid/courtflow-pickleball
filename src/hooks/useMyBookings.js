import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useToday } from "./useToday";
import { bookingRows, recentCopies } from "../utils/myBookings";

// The signed-in person's open play bookings (copies on their account), each with its live event and private
// request, so Home and the bell show the same status the booking page does. Up to 10 upcoming ones are listened to.
export function useMyBookings(uid) {
  const today = useToday();
  const [copies, setCopies] = useState([]);
  const [events, setEvents] = useState({});
  const [requests, setRequests] = useState({});
  const [tick, setTick] = useState(0); // "starting soon" needs the clock
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setCopies([]);
    if (!uid) return;
    return onSnapshot(collection(db, "accounts", uid, "bookings"),
      (s) => setCopies(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setCopies([]));
  }, [uid]);

  const recent = useMemo(() => recentCopies(copies, today), [copies, today]);
  const key = recent.map((c) => `${c.clubId}/${c.eventId}/${c.id}`).join(",");
  useEffect(() => {
    const unsubs = recent.flatMap((c) => {
      const eventRef = doc(db, "clubs", c.clubId, "events", c.eventId);
      // A refused read (club turned private, event deleted) just drops the row.
      return [
        onSnapshot(eventRef, (s) => setEvents((cur) => ({ ...cur, [c.id]: s.exists() ? { id: s.id, ...s.data() } : null })),
          () => setEvents((cur) => ({ ...cur, [c.id]: null }))),
        onSnapshot(doc(eventRef, "requests", c.id), (s) => setRequests((cur) => ({ ...cur, [c.id]: s.exists() ? s.data() : "gone" })),
          () => {}),
      ];
    });
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => bookingRows(recent, events, requests), [recent, events, requests, tick]);
}
