import { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { seedSession } from "../data/constants";

export function useSessionData(sessionId) {
  const [session, setSession] = useState(seedSession);
  const [players, setPlayers] = useState([]);
  const [courts, setCourts] = useState([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured || !sessionId) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const sRef = doc(db, "sessions", sessionId);
    const unsubS = onSnapshot(sRef, (s) => {
      if (s.exists()) setSession(s.data());
    });
    const pq = query(collection(db, "sessions", sessionId, "players"), orderBy("createdAt"));
    const cq = query(collection(db, "sessions", sessionId, "courts"), orderBy("courtNumber"));
    const unsubP = onSnapshot(pq, (s) => setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const unsubC = onSnapshot(cq, (s) => setCourts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    setBusy(false);
    return () => { unsubS(); unsubP(); unsubC(); };
  }, [sessionId]);

  return { session, setSession, players, courts, busy };
}
