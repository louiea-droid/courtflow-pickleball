import { deleteDoc, deleteField, doc, getDoc, runTransaction, setDoc, updateDoc, writeBatch } from "firebase/firestore";
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
// Assigning moves the umpire off any other court they hold (one court per volunteer) and updates their record.
export function assignCourt(base, courtId, umpire, claims = []) {
  const batch = writeBatch(db);
  claims.filter((c) => c.uid === umpire.id && c.id !== courtId).forEach((c) => batch.delete(at(base, "courtClaims", c.id)));
  batch.set(at(base, "courtClaims", courtId), { uid: umpire.id, name: umpire.name });
  batch.update(at(base, "umpires", umpire.id), { court: courtId });
  return batch.commit();
}

// ---- Umpire (volunteer or manager)
export const joinAsUmpire = (base, uid, { code, name }) =>
  setDoc(at(base, "umpires", uid), { code, name: name.trim().slice(0, 40), at: Date.now() });
export const readOwnRecord = async (base, uid) => (await getDoc(at(base, "umpires", uid))).data() || null;
// A registration from an older link can't be updated (the rules only allow creating one), so it goes first.
export const deleteOwnRecord = (base, uid) => deleteDoc(at(base, "umpires", uid));
export const readSettings = async (base) => (await getDoc(at(base, "private", "umpire"))).data();
// A claim is a create, so the rules refuse it when someone already holds the court. The umpire's record names the court
// in the same batch, which is how the rules keep each volunteer to one court.
export function claimCourt(base, courtId, uid, name) {
  const batch = writeBatch(db);
  batch.set(at(base, "courtClaims", courtId), { uid, name });
  batch.update(at(base, "umpires", uid), { court: courtId });
  return batch.commit();
}
// Releasing only removes the claim: a record naming a released court counts as holding none.
export const releaseCourt = (base, courtId) => deleteDoc(at(base, "courtClaims", courtId));
// ponytail: last write wins if two scorers tap at the same moment (a manager and a volunteer on one court); a
// transaction would fix that but fails offline, which a gym with weak wifi would hit more often.
export const writeScore = (base, courtId, score) => updateDoc(at(base, "courts", courtId), { score });
// Stop keeping a score on this match: the court card goes back to the plain win buttons.
export const clearScore = (base, courtId) => updateDoc(at(base, "courts", courtId), { score: deleteField() });
// Two open Dashboards must not both record one confirmed game: the first device to mark the court records it.
// Resolves to false when another device already did, or the score changed. Transactions need a connection, so an
// offline device records nothing and the court keeps its Record button.
export function claimRecording(base, courtId, confirmedAt) {
  const ref = at(base, "courts", courtId);
  return runTransaction(db, async (tx) => {
    const d = (await tx.get(ref)).data();
    if (!d?.score || d.score.confirmed !== confirmedAt || d.score.start !== d.start || d.recordedConfirm === confirmedAt) return false;
    tx.update(ref, { recordedConfirm: confirmedAt });
    return true;
  });
}
