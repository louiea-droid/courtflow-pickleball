// Player self check-in writes (docs/superpowers/specs/2026-11-13-self-checkin-design.md). firestore.rules allows the phone
// only these exact shapes; the host's switch and code live at {event}/private/checkin = { on, code }.
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { newCheckinCode } from "./selfCheckin";

const at = (base, ...rest) => doc(db, ...base, ...rest);

// Host: switch self check-in on (keeping the code, or making the first one) or off, and whether players type the code
// (`ask`, default on; off puts the code in the QR's link). New code makes a fresh one, so every old QR stops.
export const setCheckin = (base, { on, code, ask = true }) => setDoc(at(base, "private", "checkin"), { on, ask, code: code || newCheckinCode() });
export const renewCheckinCode = (base, { on, ask = true }) => setDoc(at(base, "private", "checkin"), { on, ask, code: newCheckinCode() });

// Phone: register with the code. A record from an older code can't be updated (create only), so it goes first.
export async function joinCheckin(base, uid, code) {
  const ref = at(base, "checkins", uid);
  const own = (await getDoc(ref).catch(() => null))?.data();
  if (own?.code === code) return;
  if (own) await deleteDoc(ref);
  await setDoc(ref, { code, at: Date.now() });
}

// Check a listed player in; `skill` only for an unrated player (the rules refuse it for a rated one).
export const checkInSelf = (base, id, skill) => updateDoc(at(base, "players", id), {
  checked: true, checkedAt: Date.now(), breakAt: null, ...(skill ? { skill, selfRated: true } : {}),
});

export async function addSelf(base, name, skill) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await setDoc(at(base, "players", id), {
    id, name: name.trim().slice(0, 40), skill, selfRated: true, checked: true, checkedAt: now, createdAt: now, games: 0, wins: 0, losses: 0,
  });
  return id;
}
