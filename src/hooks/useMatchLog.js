import { useEffect, useState } from "react";
import {
  collection, limit, onSnapshot, orderBy, query,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export function useMatchLog(base, count = 20) {
  const key = base ? base.join("/") : "";
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!firebaseConfigured || !key) {
      setLog([]);
      return;
    }
    const q = query(
      collection(db, ...key.split("/"), "matchLog"),
      orderBy("recordedAt", "desc"),
      limit(count)
    );
    const unsub = onSnapshot(q, (s) => setLog(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [key, count]);

  return log;
}
