import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

// Pending join requests of every club the person owns or manages, for the notifications bell. One listener per club
// (the same query as useJoinRequests). A refused listener just contributes nothing; the others still work.
export function useManagerJoinRequests(uid, clubs) {
  const [byClub, setByClub] = useState({});
  const managedKey = JSON.stringify(clubs.filter((c) => c.role === "owner" || c.role === "manager").map((c) => [c.id, c.clubName]));

  useEffect(() => {
    setByClub({});
    const managed = JSON.parse(managedKey);
    if (!uid || !firebaseConfigured || !managed.length) return undefined;
    const stops = managed.map(([clubId, clubName]) => onSnapshot(
      query(collection(db, "clubs", clubId, "joinRequests"), where("status", "==", "pending")),
      (s) => setByClub((prev) => ({
        ...prev,
        [clubId]: s.docs.map((d) => ({ id: d.id, clubId, clubName, name: d.data().name || "Someone", createdAt: d.data().createdAt || 0 })),
      })),
      () => setByClub((prev) => ({ ...prev, [clubId]: [] })),
    ));
    return () => stops.forEach((stop) => stop());
  }, [uid, managedKey]);

  return useMemo(() => Object.values(byClub).flat(), [byClub]);
}
