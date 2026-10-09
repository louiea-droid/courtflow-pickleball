import { useEffect, useState } from "react";
import { collectionGroup, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { listedSessions, queryFromDate } from "../utils/sessions";
import { useToday } from "./useToday";

// Upcoming open play of every public club, joined or not: one collection-group query (events carry clubPublic, see
// utils/sessions.js and the rule in firestore.rules). The club id comes from the document's path, never from its data.
// ponytail: the 100 soonest events; add paging or a date window when public clubs outgrow that.
// `enabled` lets the owner of the listener (AccountApp, shared by Home and Find session) keep it off on other screens; it also
// re-subscribes when the day changes, so the lower bound never goes stale.
export function useSessions(enabled = true) {
  const today = useToday();
  const [state, setState] = useState({ sessions: [], ready: false, error: false });
  useEffect(() => {
    if (!enabled) return undefined;
    if (!firebaseConfigured) { setState({ sessions: [], ready: true, error: false }); return undefined; }
    return onSnapshot(
      query(collectionGroup(db, "events"), where("clubPublic", "==", true), where("date", ">=", queryFromDate()), orderBy("date"), limit(100)),
      (s) => setState({
        // Only events that live under a club (the query also sees any other `events` collection); the club id is the path's.
        sessions: listedSessions(s.docs.filter((d) => d.ref.parent.parent?.parent?.id === "clubs").map((d) => ({ ...d.data(), id: d.id, clubId: d.ref.parent.parent.id }))),
        ready: true, error: false,
      }),
      () => setState({ sessions: [], ready: true, error: true }),
    );
  }, [enabled, today]);
  return state;
}
