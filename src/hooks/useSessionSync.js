import { useEffect, useRef } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { metaFor, needsSync, sessionMeta } from "../utils/sessions";

// Managers' pages repair the club copy on each event (old events, a rename), so Find session stays true. (Switching public <->
// private is flipped in the same batch as the club, see useClubActions.updateClub; this is the backstop.) It stops after a refused
// write (for example a just-demoted manager) until the club changes or the page reloads, so a refusal can't turn into a write loop.
export function useSessionSync({ clubId, club, events, canManage }) {
  const key = club ? `${club.visibility}|${club.name}|${club.location || ""}` : "";
  const refused = useRef("");
  useEffect(() => {
    if (!canManage || !club || !events.length || refused.current === `${clubId}|${key}`) return;
    const meta = sessionMeta(clubId, club);
    const stale = events.filter((e) => needsSync(e, meta));
    if (!stale.length) return;
    (async () => {
      for (let i = 0; i < stale.length; i += 400) {
        const batch = writeBatch(db);
        stale.slice(i, i + 400).forEach((e) => batch.update(doc(db, "clubs", clubId, "events", e.id), metaFor(e, meta)));
        await batch.commit();
      }
    })().catch((err) => {
      refused.current = `${clubId}|${key}`;
      console.warn("session sync failed", err);
    });
  }, [clubId, canManage, key, events]); // eslint-disable-line react-hooks/exhaustive-deps
}
