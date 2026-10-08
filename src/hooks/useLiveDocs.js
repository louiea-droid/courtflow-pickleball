import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

export const docsOf = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));

// The documents at a path (an array of segments, or null for none), live. A path the person may not read
// (the rules refuse) simply yields nothing.
export function useDocs(path) {
  const key = path ? path.join("/") : "";
  const [docs, setDocs] = useState([]);
  useEffect(() => {
    setDocs([]);
    if (!firebaseConfigured || !key) return undefined;
    return onSnapshot(collection(db, ...key.split("/")), (s) => setDocs(docsOf(s)), () => setDocs([]));
  }, [key]);
  return docs;
}
