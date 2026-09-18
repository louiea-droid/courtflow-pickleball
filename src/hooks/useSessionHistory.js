import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export function useSessionHistory(sessionId) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!firebaseConfigured || !sessionId) {
      setHistory([]);
      return;
    }
    const q = query(collection(db, "sessions", sessionId, "history"), orderBy("endedAt", "desc"));
    const unsub = onSnapshot(q, (s) => setHistory(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [sessionId]);

  return history;
}
