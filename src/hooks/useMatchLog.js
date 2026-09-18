import { useEffect, useState } from "react";
import {
  collection, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export function useMatchLog(sessionId, count = 20) {
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!firebaseConfigured || !sessionId) {
      setLog([]);
      return;
    }
    const q = query(
      collection(db, "sessions", sessionId, "matchLog"),
      orderBy("recordedAt", "desc"),
      limit(count)
    );
    const unsub = onSnapshot(q, (s) => setLog(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [sessionId, count]);

  return log;
}
