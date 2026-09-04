import { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query, writeBatch,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { SESSION_ID, seedSession } from "../data/constants";

export async function seedSessionData() {
  const batch = writeBatch(db);
  batch.set(doc(db, "sessions", SESSION_ID), seedSession, { merge: true });
  for (let i = 1; i <= seedSession.courts; i++) {
    batch.set(doc(db, "sessions", SESSION_ID, "courts", `court-${i}`), {
      courtNumber: i, start: Date.now(), teamA: [], teamB: [],
    });
  }
  await batch.commit();
}

export function useSessionData() {
  const [session, setSession] = useState(seedSession);
  const [players, setPlayers] = useState([]);
  const [courts, setCourts] = useState([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured) {
      setBusy(false);
      return;
    }
    const sRef = doc(db, "sessions", SESSION_ID);
    const unsubS = onSnapshot(sRef, (s) => {
      if (s.exists()) setSession(s.data());
      else seedSessionData();
    });
    const pq = query(collection(db, "sessions", SESSION_ID, "players"), orderBy("createdAt"));
    const cq = query(collection(db, "sessions", SESSION_ID, "courts"), orderBy("courtNumber"));
    const unsubP = onSnapshot(pq, (s) => setPlayers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const unsubC = onSnapshot(cq, (s) => setCourts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    setBusy(false);
    return () => { unsubS(); unsubP(); unsubC(); };
  }, []);

  return { session, setSession, players, courts, busy };
}
