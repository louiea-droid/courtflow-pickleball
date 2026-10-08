import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { permissions } from "../utils/clubs";

// The open club and what this person may do in it. The member record is the single source of
// truth for the role. `status` is "missing" when the club can't be read or doesn't exist, so a
// club that was deleted while open (or a private club the person isn't in) never shows a blank page.
export function useClubDoc(uid, clubId) {
  const [state, setState] = useState({ club: null, member: null, status: "loading" });
  useEffect(() => {
    setState({ club: null, member: null, status: "loading" });
    if (!firebaseConfigured || !uid || !clubId) return;
    let club = null;
    let member = null;
    let clubDone = false;
    let memberDone = false;
    const publish = () => {
      if (clubDone && memberDone) setState({ club, member, status: club ? "ready" : "missing" });
    };
    const unsubClub = onSnapshot(
      doc(db, "clubs", clubId),
      (s) => { club = s.exists() ? { id: s.id, ...s.data() } : null; clubDone = true; publish(); },
      () => { club = null; clubDone = true; publish(); },
    );
    // A member record the server hasn't confirmed yet (our own pending write, such as an invite join the
    // rules may still refuse) doesn't count: the screen must not flip to the member view and back.
    const unsubMember = onSnapshot(
      doc(db, "clubs", clubId, "members", uid),
      { includeMetadataChanges: true },
      (s) => { member = s.exists() && !s.metadata.hasPendingWrites ? s.data() : null; memberDone = true; publish(); },
      () => { member = null; memberDone = true; publish(); },
    );
    return () => { unsubClub(); unsubMember(); };
  }, [uid, clubId]);
  const role = state.member?.role || null;
  return { ...state, role, ...permissions(role) };
}
