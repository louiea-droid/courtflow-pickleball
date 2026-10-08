import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// The clubs this person belongs to, from the small copies under their account (no index needed).
// The real permission is always the club's own member record, so a stale copy can only show a
// name; opening it checks the club itself.
export function useMyClubs(uid) {
  const [state, setState] = useState({ clubs: [], ready: false });
  useEffect(() => {
    setState({ clubs: [], ready: false });
    if (!firebaseConfigured || !uid) return;
    return onSnapshot(
      collection(db, "accounts", uid, "memberships"),
      (s) => setState({
        clubs: s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.clubName || "").localeCompare(b.clubName || "")),
        ready: true,
      }),
      () => setState({ clubs: [], ready: true }),
    );
  }, [uid]);
  return state;
}
