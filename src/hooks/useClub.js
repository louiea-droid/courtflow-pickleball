import { useEffect, useState } from "react";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { seedSession } from "../data/constants";
import { authEmail, loadStoredClub, saveStoredClub, slugifyClub } from "../utils/club";

async function createFreshSession(batch, id, clubName) {
  batch.set(doc(db, "sessions", id), { ...seedSession, location: clubName, createdAt: Date.now() });
  for (let i = 1; i <= seedSession.courts; i++) {
    batch.set(doc(db, "sessions", id, "courts", `court-${i}`), {
      courtNumber: i, start: Date.now(), teamA: [], teamB: [],
    });
  }
}

export function useClub() {
  // Seeded from the last-known local cache so the app can paint the
  // dashboard immediately on a repeat visit instead of flashing the login
  // screen — onAuthStateChanged (below) corrects this if the cache is
  // stale or the session is no longer valid.
  const [club, setClub] = useState(loadStoredClub);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setClub(null);
        saveStoredClub(null);
        return;
      }
      const id = user.email.slice(0, user.email.indexOf("@"));
      const snap = await getDoc(doc(db, "sessions", id));
      const next = { id, name: snap.exists() ? (snap.data().location || id) : id };
      setClub(next);
      saveStoredClub(next);
    });
    return unsubscribe;
  }, []);

  // One form, three outcomes, resolved automatically: sign in (returning
  // club), create + seed (brand-new club name), or create + leave data
  // alone (claiming a pre-auth club with data but no password yet). The
  // create call's own error/success is what disambiguates "wrong
  // password" from "no account yet" — see spec §6 for why sign-in's error
  // code is deliberately not branched on.
  async function login(rawName, password) {
    const clubName = rawName.trim();
    if (!clubName || !password) return;
    const id = slugifyClub(clubName);
    const email = authEmail(id);
    setLoggingIn(true);
    setLoginError("");
    try {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        return;
      } catch {
        // No account yet, or wrong password — the create attempt below tells us which.
      }
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          setLoginError(`Incorrect password for ${clubName}.`);
        } else if (err.code === "auth/weak-password") {
          setLoginError("Password must be at least 6 characters.");
        } else {
          setLoginError("Couldn't log in — please try again.");
        }
        return;
      }
      const existing = await getDoc(doc(db, "sessions", id));
      if (!existing.exists()) {
        const batch = writeBatch(db);
        await createFreshSession(batch, id, clubName);
        await batch.commit();
      }
      // Existing doc with no prior Auth account (legacy/claim case): left untouched.
    } finally {
      setLoggingIn(false);
    }
  }

  // Local sign-out only — no data changes. For "the game's over," use endSession.
  async function switchClub() {
    await signOut(auth);
  }

  // Filled in by the next task (archive + reset today's session).
  async function endSession() {}

  return { club, loggingIn, loginError, login, switchClub, endSession };
}
