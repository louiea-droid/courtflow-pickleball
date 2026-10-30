import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// Pending join requests of every club the person owns or manages, for the notifications bell. One listener per club
// (the same query as useJoinRequests). A refused listener just contributes nothing; the others still work.
// A refused listener is dead for good, and right after creating a club or joining by the manager link the card shows
// before the server has the member record, so a refusal is retried 3 times, 3 s apart (as useInbox does).
export function useManagerJoinRequests(uid, clubs) {
  const [byClub, setByClub] = useState({});
  const managedKey = JSON.stringify(clubs.filter((c) => c.role === "owner" || c.role === "manager").map((c) => [c.id, c.clubName]));

  useEffect(() => {
    setByClub({});
    const managed = JSON.parse(managedKey);
    if (!uid || !firebaseConfigured || !managed.length) return undefined;
    let stopped = false;
    const offs = {};
    const timers = {};
    const listen = (clubId, clubName, tries) => {
      offs[clubId] = onSnapshot(
        query(collection(db, "clubs", clubId, "joinRequests"), where("status", "==", "pending")),
        (s) => setByClub((prev) => ({
          ...prev,
          [clubId]: s.docs.map((d) => ({ id: d.id, clubId, clubName, name: d.data().name || "Someone", createdAt: d.data().createdAt || 0 })),
        })),
        () => {
          setByClub((prev) => ({ ...prev, [clubId]: [] }));
          if (!stopped && tries < 3) timers[clubId] = setTimeout(() => listen(clubId, clubName, tries + 1), 3000);
        },
      );
    };
    managed.forEach(([clubId, clubName]) => listen(clubId, clubName, 0));
    return () => {
      stopped = true;
      Object.values(offs).forEach((off) => off());
      Object.values(timers).forEach(clearTimeout);
    };
  }, [uid, managedKey]);

  return useMemo(() => Object.values(byClub).flat(), [byClub]);
}
