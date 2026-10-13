import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { newInviteCode } from "./clubs";

const at = (base, ...rest) => doc(db, ...base, ...rest);

// ---- Host (manager / quick-session owner)
// The link's code and the scoring settings the volunteer's screen uses travel in one owner-only doc.
export async function createLink(base, { style, to }) {
  const code = newInviteCode();
  await setDoc(at(base, "private", "umpire"), { code, style, to });
  return code;
}
// New link: a new code stops every old link, and registered umpires and their claims are cleared so courts are free again.
export async function renewLink(base, { style, to, umpires = [], claims = [] }) {
  const code = newInviteCode();
  const batch = writeBatch(db);
  batch.set(at(base, "private", "umpire"), { code, style, to });
  umpires.forEach((u) => batch.delete(at(base, "umpires", u.id)));
  claims.forEach((c) => batch.delete(at(base, "courtClaims", c.id)));
  await batch.commit();
  return code;
}
export const syncSettings = (base, { style, to }) => updateDoc(at(base, "private", "umpire"), { style, to }).catch(() => {});
export const assignCourt = (base, courtId, umpire) => setDoc(at(base, "courtClaims", courtId), { uid: umpire.id, name: umpire.name });

// ---- Umpire (volunteer or manager)
export const joinAsUmpire = (base, uid, { code, name }) =>
  setDoc(at(base, "umpires", uid), { code, name: name.trim().slice(0, 40), at: Date.now() });
export const readOwnRecord = async (base, uid) => (await getDoc(at(base, "umpires", uid))).data() || null;
export const readSettings = async (base) => (await getDoc(at(base, "private", "umpire"))).data();
// A claim is a create: the rules refuse it when someone already holds the court.
export const claimCourt = (base, courtId, uid, name) => setDoc(at(base, "courtClaims", courtId), { uid, name });
export const releaseCourt = (base, courtId) => deleteDoc(at(base, "courtClaims", courtId));
// ponytail: last write wins if two scorers tap at the same moment (a manager and a volunteer on one court); a
// transaction would fix that but fails offline, which a gym with weak wifi would hit more often.
export const writeScore = (base, courtId, score) => updateDoc(at(base, "courts", courtId), { score });
