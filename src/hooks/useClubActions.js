import { collection, deleteDoc, deleteField, doc, getDocs, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { membershipCopy, newClubDoc, validateClubInput } from "../utils/clubs";
import { deleteClubData } from "../utils/accountData";
import { PHOTO_LIMITS, PHOTO_STEPS } from "../utils/clubPhoto";
import { compressImage } from "../utils/receipt";
import { setClubThumb } from "../components/ClubBadge";

const PICK = { message: "Choose a picture.", tooLarge: "That picture is too large. Try another one." };

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
    if (typeof next.visibility === "string") {
      // Public <-> private also flips the copy on the club's events (what Find session lists by) in the SAME batch, so the
      // events can't stay public after the club goes private. If it fails, the whole save fails visibly.
      // ponytail: one batch holds 500 writes; events past the first 499 are flipped by the managers' sync on the next page load.
      const pub = next.visibility === "public";
      const events = await getDocs(collection(db, "clubs", clubId, "events"));
      const flips = events.docs.filter((e) => e.data().clubPublic !== (pub && !e.data().walkIn));
      const batch = writeBatch(db);
      batch.update(doc(db, "clubs", clubId), next);
      flips.slice(0, 499).forEach((e) => batch.update(e.ref, { clubPublic: pub && !e.data().walkIn }));
      await batch.commit();
    } else {
      await updateDoc(doc(db, "clubs", clubId), next);
    }
    if (typeof next.name === "string") {
      try {
        await updateDoc(doc(db, "accounts", uid, "memberships", clubId), { clubName: next.name.trim() });
      } catch { /* this person has no copy of the club yet (a later part adds them); the club itself saved */ }
    }
  };

  // A new club photo (a picked file) or none (null). One batch: the 64 px copy on the club, the 256 px one in media, and the
  // copy on the club's events. ponytail: one batch holds 500 writes; events past 499 get it from useSessionSync later.
  const setClubPhoto = async (clubId, file) => {
    const [thumb, photo] = file
      ? await Promise.all([
        compressImage(file, { ...PICK, steps: PHOTO_STEPS.thumb, square: true, max: PHOTO_LIMITS.thumb }),
        compressImage(file, { ...PICK, steps: PHOTO_STEPS.photo, square: true, max: PHOTO_LIMITS.photo }),
      ])
      : ["", ""];
    const club = doc(db, "clubs", clubId);
    const events = await getDocs(collection(club, "events"));
    const batch = writeBatch(db);
    batch.update(club, { photo: thumb || deleteField() });
    if (photo) batch.set(doc(club, "media", "photo"), { image: photo, updatedAt: Date.now() });
    else batch.delete(doc(club, "media", "photo"));
    events.docs.filter((e) => (e.data().clubPhoto || "") !== thumb).slice(0, 499)
      .forEach((e) => batch.update(e.ref, { clubPhoto: thumb }));
    await batch.commit();
    setClubThumb(clubId, thumb);
  };

  // A new cover (a picked file) or none (null).
  const setClubCover = async (clubId, file) => {
    const ref = doc(db, "clubs", clubId, "media", "cover");
    if (!file) return deleteDoc(ref);
    const image = await compressImage(file, { ...PICK, steps: PHOTO_STEPS.cover, max: PHOTO_LIMITS.cover });
    await setDoc(ref, { image, updatedAt: Date.now() });
  };

  const deleteClub = async (clubId) => {
    await deleteClubData(db, clubId, uid);
    notify("Club deleted.");
  };

  return { createClub, updateClub, deleteClub, setClubPhoto, setClubCover };
}
