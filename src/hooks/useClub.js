import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, writeBatch } from "firebase/firestore";
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
      } catch (err) {
        // Only "no account with this email yet" and "wrong password" fall
        // through to the create attempt below, which is what disambiguates
        // them. Throttling and connectivity errors are not password
        // problems — reporting them as "incorrect password" would send
        // someone into a retry loop that only makes a rate limit worse.
        if (err.code === "auth/too-many-requests") {
          setLoginError("Too many attempts — wait a bit before trying again.");
          return;
        }
        if (err.code === "auth/network-request-failed") {
          setLoginError("Network error — check your connection and try again.");
          return;
        }
      }
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
        if (err.code === "auth/email-already-in-use") {
          setLoginError(`Incorrect password for ${clubName}.`);
        } else if (err.code === "auth/weak-password") {
          setLoginError("Password must be at least 6 characters.");
        } else if (err.code === "auth/operation-not-allowed") {
          setLoginError("Sign-in isn't enabled for this app yet — contact the admin.");
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

  // Closes out today's play: archives aggregate stats (if any games were
  // played), clears the match log, empties every court, resets every
  // player's stats and checks them all out, then signs out. Roster itself
  // is kept — this is not the destructive "New Session" wipe.
  async function endSession() {
    if (!club) return;
    const { id } = club;
    const [playersSnap, courtsSnap, matchLogSnap] = await Promise.all([
      getDocs(collection(db, "sessions", id, "players")),
      getDocs(collection(db, "sessions", id, "courts")),
      getDocs(collection(db, "sessions", id, "matchLog")),
    ]);
    const roster = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const totalGames = roster.reduce((n, p) => n + (p.games || 0), 0);
    const batch = writeBatch(db);
    if (totalGames > 0) {
      const historyRef = doc(collection(db, "sessions", id, "history"));
      batch.set(historyRef, {
        endedAt: Date.now(),
        matches: Math.round(totalGames / 2),
        players: roster.map((p) => ({
          id: p.id, name: p.name, games: p.games || 0, wins: p.wins || 0, losses: p.losses || 0,
        })),
      });
    }
    roster.forEach((p) => {
      batch.update(doc(db, "sessions", id, "players", p.id), {
        games: 0, wins: 0, losses: 0, partners: [], lastResult: null, checked: false,
      });
    });
    courtsSnap.forEach((d) => batch.update(d.ref, { teamA: [], teamB: [] }));
    matchLogSnap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    await signOut(auth);
  }

  return { club, loggingIn, loginError, login, switchClub, endSession };
}
