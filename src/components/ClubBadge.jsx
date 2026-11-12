import { useSyncExternalStore } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { badgeStyle, photoUrl } from "../utils/clubPhoto";
import { clubInitial } from "../utils/clubs";

// Club thumbnails by id, read once per tab for the places that only know a club's id and name (sidebar, Home, Inbox).
// "" = no photo (or the read was refused). ponytail: never refreshed until reload; a club's own screens pass `photo`.
const thumbs = new Map();
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function setClubThumb(id, photo) {
  thumbs.set(id, photo || "");
  listeners.forEach((fn) => fn());
}

function useClubThumb(id, skip) {
  const value = useSyncExternalStore(subscribe, () => thumbs.get(id));
  if (!skip && id && value === undefined && firebaseConfigured) {
    thumbs.set(id, null); // loading: one read per id
    getDoc(doc(db, "clubs", id)).then((s) => setClubThumb(id, s.data()?.photo), () => setClubThumb(id, ""));
  }
  return value || "";
}

// A club's badge: its photo, or its initial on its color. `photo` undefined = look it up; "" = known to have none.
export default function ClubBadge({ id, name, photo, className = "" }) {
  const cached = useClubThumb(id, photo !== undefined);
  const given = photo !== undefined ? photo : cached;
  const src = photoUrl(given) ? given : ""; // a malformed value shows the initial
  return (
    <span className={`${className}${src ? " club-photo-badge" : ""}`} style={badgeStyle(id, src)} aria-hidden="true">
      {src ? null : clubInitial(name)}
    </span>
  );
}
