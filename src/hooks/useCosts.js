import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export function useCosts(base) {
  const key = base ? base.join("/") : "";
  const [costs, setCosts] = useState([]);

  useEffect(() => {
    if (!firebaseConfigured || !key) {
      setCosts([]);
      return;
    }
    const q = query(collection(db, ...key.split("/"), "costs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (s) => setCosts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [key]);

  return costs;
}
