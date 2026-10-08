import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { permissions } from "../utils/clubs";

// The open club and what this person may do in it. The member record is the single source of
// truth for the role. `status` is "missing" when the club can't be read or doesn't exist, so a
// club that was deleted while open (or a private club the person isn't in) never shows a blank page.
// `confirmed` is true only when the server has answered for both the club and the member record (no cache,
// no pending write of ours): anything that deletes data because "you are not a member" must wait for it.
export function useClubDoc(uid, clubId) {
  const [state, setState] = useState({ club: null, member: null, status: "loading", confirmed: false });
  useEffect(() => {
    setState({ club: null, member: null, status: "loading", confirmed: false });
    if (!firebaseConfigured || !uid || !clubId) return;
    let club = null;
    let member = null;
    let clubDone = false;
    let memberDone = false;
    let clubFresh = false;
    let memberFresh = false;
    const publish = () => {
      if (clubDone && memberDone) setState({ club, member, status: club ? "ready" : "missing", confirmed: clubFresh && memberFresh });
    };
    const unsubClub = onSnapshot(
      doc(db, "clubs", clubId),
      { includeMetadataChanges: true },
      (s) => { club = s.exists() ? { id: s.id, ...s.data() } : null; clubFresh = !s.metadata.fromCache; clubDone = true; publish(); },
      () => { club = null; clubFresh = false; clubDone = true; publish(); },
    );
    // A member record the server hasn't confirmed yet (our own pending write, such as an invite join the
    // rules may still refuse) doesn't count: the screen must not flip to the member view and back.
    const unsubMember = onSnapshot(
      doc(db, "clubs", clubId, "members", uid),
      { includeMetadataChanges: true },
      (s) => {
        member = s.exists() && !s.metadata.hasPendingWrites ? s.data() : null;
        memberFresh = !s.metadata.fromCache && !s.metadata.hasPendingWrites;
        memberDone = true;
        publish();
      },
      () => { member = null; memberFresh = false; memberDone = true; publish(); },
    );
    return () => { unsubClub(); unsubMember(); };
  }, [uid, clubId]);
  const role = state.member?.role || null;
  return { ...state, role, ...permissions(role) };
}
