import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

function useCollection(sessionId, name, order) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!firebaseConfigured || !sessionId) {
      setRows([]);
      return;
    }
    const q = query(collection(db, "sessions", sessionId, name), orderBy(order));
    return onSnapshot(q, (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [sessionId, name, order]);
  return rows;
}

export const useBookings = (sessionId) => useCollection(sessionId, "bookings", "date");

// Players' join requests. Only the club's own account can list these (see
// firestore.rules), so call this from the signed-in app only.
export const useBookingRequests = (sessionId) => useCollection(sessionId, "bookingRequests", "createdAt");
