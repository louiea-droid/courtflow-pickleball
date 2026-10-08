import { useEffect, useState } from "react";
import { collection, doc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

const RANK = { owner: 0, manager: 1, member: 2 };

// Public clubs for the directory, loaded once (up to 200) and filtered on the device. The rules only
// allow listing public clubs, so the query says so. ponytail: past 200 public clubs the search can miss
// some; the upgrade is a composite index (visibility + nameLower) and a prefix query.
export function useDirectory() {
  const [state, setState] = useState({ clubs: [], ready: false, error: false });
  useEffect(() => {
    let alive = true;
    if (!firebaseConfigured) return;
    getDocs(query(collection(db, "clubs"), where("visibility", "==", "public"), limit(200))).then(
      (s) => alive && setState({ clubs: s.docs.map((d) => ({ id: d.id, ...d.data() })), ready: true, error: false }),
      () => alive && setState({ clubs: [], ready: true, error: true }),
    );
    return () => { alive = false; };
  }, []);
  return state;
}

// Everyone in a club: the owner, then managers, then members by name. Only members can read this.
export function useMembers(clubId) {
  const [state, setState] = useState({ members: [], ready: false });
  useEffect(() => {
    setState({ members: [], ready: false });
    if (!firebaseConfigured || !clubId) return;
    return onSnapshot(
      collection(db, "clubs", clubId, "members"),
      (s) => setState({
        members: s.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (RANK[a.role] ?? 9) - (RANK[b.role] ?? 9) || (a.name || "").localeCompare(b.name || "")),
        ready: true,
      }),
      () => setState({ members: [], ready: true }),
    );
  }, [clubId]);
  return state;
}

// Pending join requests, oldest first. Managers only (pass null for everyone else).
export function useJoinRequests(clubId) {
  const [state, setState] = useState({ requests: [], ready: false });
  useEffect(() => {
    setState({ requests: [], ready: false });
    if (!firebaseConfigured || !clubId) return;
    return onSnapshot(
      query(collection(db, "clubs", clubId, "joinRequests"), where("status", "==", "pending")),
      (s) => setState({
        requests: s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)),
        ready: true,
      }),
      () => setState({ requests: [], ready: true }),
    );
  }, [clubId]);
  return state;
}

// This person's own request to the club (pending or declined), or null.
export function useMyJoinRequest(uid, clubId) {
  const [state, setState] = useState({ request: null, ready: false });
  useEffect(() => {
    setState({ request: null, ready: false });
    if (!firebaseConfigured || !uid || !clubId) return;
    return onSnapshot(
      doc(db, "clubs", clubId, "joinRequests", uid),
      (s) => setState({ request: s.exists() ? { id: s.id, ...s.data() } : null, ready: true }),
      () => setState({ request: null, ready: true }),
    );
  }, [uid, clubId]);
  return state;
}

// The club's current invite code, or null when no link was made yet. `docId` is "invite" (managers read it)
// or "managerInvite" (the owner's link that makes managers; only the owner reads it).
export function useInvite(clubId, docId = "invite") {
  const [state, setState] = useState({ code: null, ready: false });
  useEffect(() => {
    setState({ code: null, ready: false });
    if (!firebaseConfigured || !clubId) return;
    return onSnapshot(
      doc(db, "clubs", clubId, "private", docId),
      (s) => setState({ code: s.exists() ? s.data().code : null, ready: true }),
      () => setState({ code: null, ready: true }),
    );
  }, [clubId, docId]);
  return state;
}
