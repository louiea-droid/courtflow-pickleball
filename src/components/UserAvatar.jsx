import { useSyncExternalStore } from "react";
import { UserRound } from "lucide-react";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { avatarSrc } from "../utils/avatar";

// Profile pictures by uid, read once per tab (`avatars/{uid}`), like ClubBadge's club thumbnails.
// ponytail: someone else's new picture shows after a reload; your own updates at once through saveAvatar.
const pics = new Map(); // uid -> src ("" = none), null while loading
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const put = (uid, src) => { pics.set(uid, src); listeners.forEach((fn) => fn()); };

export function usePicture(uid) {
  const value = useSyncExternalStore(subscribe, () => pics.get(uid));
  if (uid && value === undefined && firebaseConfigured) {
    pics.set(uid, null);
    getDoc(doc(db, "avatars", uid)).then((s) => put(uid, avatarSrc(s.data())), () => put(uid, ""));
  }
  return value || "";
}

// Save your picture: { image } or { builtin }, or null to remove it.
export async function saveAvatar(uid, picture) {
  const ref = doc(db, "avatars", uid);
  if (picture) await setDoc(ref, { ...picture, updatedAt: serverTimestamp() });
  else await deleteDoc(ref);
  put(uid, avatarSrc(picture));
}

// A person's picture, or a plain person icon when they have none (never initials). Decorative: the name beside it is the label.
export default function UserAvatar({ uid, size = 30, className = "" }) {
  const src = usePicture(uid);
  return (
    <span className={`user-avatar${src ? "" : " none"} ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      {src ? <img src={src} alt="" width={size} height={size} /> : <UserRound size={Math.round(size * 0.55)} />}
    </span>
  );
}
