import { useEffect, useState } from "react";
import {
  collection, doc, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { seedSession } from "../data/constants";

// `base` is the path of the session document (utils/paths.js). The hook keys on its
// joined string, so a new array with the same path does not resubscribe.
export function useSessionData(base) {
  const key = base ? base.join("/") : "";
  const [session, setSession] = useState(seedSession);
  const [players, setPlayers] = useState([]);
  const [courts, setCourts] = useState([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!firebaseConfigured || !key) {
      setBusy(false);
      return;
    }
    setBusy(true);
    const path = key.split("/");
    // busy only clears once all three listeners have delivered their first
    // snapshot, so the loading screen doesn't hand off to a still-empty UI.
    const loaded = { session: false, players: false, courts: false };
    const checkLoaded = () => {
      if (loaded.session && loaded.players && loaded.courts) setBusy(false);
    };
    const unsubS = onSnapshot(doc(db, ...path), (s) => {
      if (s.exists()) setSession(s.data());
      loaded.session = true;
      checkLoaded();
    });
    const pq = query(collection(db, ...path, "players"), orderBy("createdAt"));
    const cq = query(collection(db, ...path, "courts"), orderBy("courtNumber"));
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
  }, [key]);

  return { session, setSession, players, courts, busy };
}
