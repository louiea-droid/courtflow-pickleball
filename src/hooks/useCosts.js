import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export function useCosts(sessionId) {
  const [costs, setCosts] = useState([]);

  useEffect(() => {
    if (!firebaseConfigured || !sessionId) {
      setCosts([]);
      return;
    }
    const q = query(collection(db, "sessions", sessionId, "costs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (s) => setCosts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [sessionId]);

  return costs;
}
