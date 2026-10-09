import { useEffect } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { needsSync, sessionMeta } from "../utils/sessions";

// Managers' pages repair the club copy on each event (old events, a rename, public <-> private), so Find session
// stays true. A second pass finds nothing to do, so it can't loop.
export function useSessionSync({ clubId, club, events, canManage }) {
  const key = club ? `${club.visibility}|${club.name}|${club.location || ""}` : "";
  useEffect(() => {
    if (!canManage || !club || !events.length) return;
    const meta = sessionMeta(clubId, club);
    const stale = events.filter((e) => needsSync(e, meta));
    if (!stale.length) return;
    (async () => {
      for (let i = 0; i < stale.length; i += 400) {
        const batch = writeBatch(db);
        stale.slice(i, i + 400).forEach((e) => batch.update(doc(db, "clubs", clubId, "events", e.id), meta));
        await batch.commit();
      }
    })().catch((err) => console.warn("session sync failed", err)); // ponytail: a failed repair is retried the next time the page loads
  }, [clubId, canManage, key, events]); // eslint-disable-line react-hooks/exhaustive-deps
}
