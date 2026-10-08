import { useEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { friendshipDoc, isFriendCode, nameRange, normalizeCode, pairId } from "../utils/friends";

// Everything between this person and others: friends, requests they got, requests they sent (the page splits
// them with friendBuckets). Live. The rules only let a person read friendships they are in.
export function useFriendships(uid) {
  const [state, setState] = useState({ friendships: [], ready: false });
  useEffect(() => {
    setState({ friendships: [], ready: false });
    if (!firebaseConfigured || !uid) return undefined;
    return onSnapshot(
      query(collection(db, "friendships"), where("users", "array-contains", uid)),
      (s) => setState({ friendships: s.docs.map((d) => ({ id: d.id, ...d.data() })), ready: true }),
      () => setState({ friendships: [], ready: true }),
    );
  }, [uid]);
  return state;
}

// Search by friend code (one lookup) or by the start of a name (up to 20, from the people who allow it).
// status: "idle" | "short" (under 2 characters) | "loading" | "done" | "error". The person is never in their own results.
export function useFriendSearch(uid) {
  const [state, setState] = useState({ results: [], status: "idle" });
  const latest = useRef(0);
  const search = async (text) => {
    const run = ++latest.current;
    const code = normalizeCode(text);
    const range = nameRange(text);
    if (!isFriendCode(code) && !range) return setState({ results: [], status: text.trim() ? "short" : "idle" });
    setState((s) => ({ ...s, status: "loading" }));
    try {
      let found;
      if (isFriendCode(code)) {
        const snap = await getDoc(doc(db, "friendCodes", code));
        found = snap.exists() ? [{ id: snap.data().uid, name: snap.data().name }] : [];
      } else {
        const snap = await getDocs(query(
          collection(db, "profiles"), where("nameLower", ">=", range[0]), where("nameLower", "<=", range[1]), limit(20),
        ));
        found = snap.docs.map((d) => ({ id: d.id, name: d.data().name }));
      }
      if (run === latest.current) setState({ results: found.filter((p) => p.id !== uid), status: "done" });
    } catch {
      if (run === latest.current) setState({ results: [], status: "error" });
    }
  };
  return { ...state, search };
}

// Every write for friends. Each one rejects on failure; the page turns that into a message.
// `remove` is cancel (my request), decline (theirs) and unfriend.
export function useFriendActions({ uid, name }) {
  const ref = (id) => doc(db, "friendships", id);
  const sendRequest = (other) => setDoc(ref(pairId(uid, other.id)), friendshipDoc(uid, name, other.id, other.name, Date.now()));
  const accept = (f) => updateDoc(ref(f.id), { status: "accepted" });
  const remove = (f) => deleteDoc(ref(f.id));
  return { sendRequest, accept, remove };
}
