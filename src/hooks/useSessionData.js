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
    // busy only clears once all three listeners have delivered their first
    // snapshot, so the loading screen doesn't hand off to a still-empty UI.
    const loaded = { session: false, players: false, courts: false };
    const checkLoaded = () => {
      if (loaded.session && loaded.players && loaded.courts) setBusy(false);
    };
    const sRef = doc(db, "sessions", sessionId);
    const unsubS = onSnapshot(sRef, (s) => {
      if (s.exists()) setSession(s.data());
      loaded.session = true;
      checkLoaded();
    });
    const pq = query(collection(db, "sessions", sessionId, "players"), orderBy("createdAt"));
    const cq = query(collection(db, "sessions", sessionId, "courts"), orderBy("courtNumber"));
    const unsubP = onSnapshot(pq, (s) => {
      setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      loaded.players = true;
      checkLoaded();
    });
    const unsubC = onSnapshot(cq, (s) => {
      setCourts(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      loaded.courts = true;
      checkLoaded();
    });
    return () => { unsubS(); unsubP(); unsubC(); };
  }, [sessionId]);

  return { session, setSession, players, courts, busy };
}
