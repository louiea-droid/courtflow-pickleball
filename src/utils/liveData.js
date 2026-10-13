import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { newInviteCode } from "./clubs";

// A game's Live Board link (docs/superpowers/specs/2026-10-13-open-play-live-design.md). The key and what the board
// shows from the event and the club (a screen can't read those) live in events/{e}/private/live.
const at = (base, ...rest) => doc(db, ...base, ...rest);
const newKey = () => newInviteCode() + newInviteCode(); // 16 characters
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)); // Firestore refuses undefined

export async function createLiveLink(base, info) {
  const key = newKey();
  await setDoc(at(base, "private", "live"), { ...clean(info), key });
  return key;
}
// New link: a new key stops every screen at once, and their registrations go.
export async function renewLiveLink(base, info, viewers = []) {
  const key = newKey();
  const batch = writeBatch(db);
  batch.set(at(base, "private", "live"), { ...clean(info), key });
  viewers.forEach((v) => batch.delete(at(base, "viewers", v.id)));
  await batch.commit();
  return key;
}
export const syncLiveInfo = (base, info) => updateDoc(at(base, "private", "live"), clean(info)).catch(() => {});

// A screen registers with the link's key. A record from an older link can't be updated (create only), so it goes first.
export async function joinAsViewer(base, uid, key) {
  const ref = at(base, "viewers", uid);
  const own = (await getDoc(ref)).data();
  if (own?.key === key) return;
  if (own) await deleteDoc(ref);
  await setDoc(ref, { key, at: Date.now() });
}
