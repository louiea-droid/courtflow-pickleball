import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// The host's own view of the umpire link's code and settings (owner / managers only; null code = not created yet).
export function useUmpireLink(base) {
  const key = base ? base.join("/") : "";
  const [state, setState] = useState({ code: null, style: null, to: null, ready: false });
  useEffect(() => {
    if (!firebaseConfigured || !key) return undefined;
    return onSnapshot(doc(db, ...key.split("/"), "private", "umpire"),
      (s) => setState({ code: s.data()?.code || null, style: s.data()?.style || null, to: s.data()?.to || null, ready: true }),
      () => setState({ code: null, style: null, to: null, ready: true }));
  }, [key]);
  return state;
}
