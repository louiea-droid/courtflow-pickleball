import { collection, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { membershipCopy, newClubDoc, validateClubInput } from "../utils/clubs";
import { deleteClubData } from "../utils/accountData";

// Writes for clubs. The signed-in person is the owner of what they create.
export function useClubActions({ uid, name, notify }) {
  // One batch: the club, the owner's member record and the owner's "My clubs" copy, or nothing.
  // Resolves to { id } or { error } (a message for the form).
  const createClub = async (input) => {
    const error = validateClubInput(input);
    if (error) return { error };
    const now = Date.now();
    const ref = doc(collection(db, "clubs"));
    const club = newClubDoc(input, uid, now);
    try {
      const batch = writeBatch(db);
      batch.set(ref, club);
      batch.set(doc(ref, "members", uid), { role: "owner", name: name || "Owner", joinedAt: now });
      batch.set(doc(db, "accounts", uid, "memberships", ref.id), membershipCopy(club, "owner", now));
      await batch.commit();
      return { id: ref.id };
    } catch {
      return { error: "Couldn't create the club. Check your connection and try again." };
    }
  };

  // `patch` holds club fields (name, description, location, visibility, defaults, rules, ...).
  // A new name also updates the search copy and this person's "My clubs" copy.
  const updateClub = async (clubId, patch) => {
    const next = { ...patch };
    if (typeof next.name === "string") next.nameLower = next.name.trim().toLowerCase();
    await updateDoc(doc(db, "clubs", clubId), next);
    if (typeof next.name === "string") {
      try {
        await updateDoc(doc(db, "accounts", uid, "memberships", clubId), { clubName: next.name.trim() });
      } catch { /* this person has no copy of the club yet (a later part adds them); the club itself saved */ }
    }
  };

  const deleteClub = async (clubId) => {
    await deleteClubData(db, clubId, uid);
    notify("Club deleted.");
  };

  return { createClub, updateClub, deleteClub };
}
