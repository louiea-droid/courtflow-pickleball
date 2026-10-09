import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth, db } from "../firebase";
import { DEFAULT_RULES, RULE_DEFAULTS_VERSION, seedSession } from "../data/constants";
import { authMessage } from "../utils/account";
import { wipeCollection } from "../utils/wipe";
import { matchCount } from "../utils/stats";

const QUICK_NAME = "Quick session";
const SUBCOLLECTIONS = ["players", "courts", "history", "costs", "matchLog", "bookings", "bookingRequests"];

function createFreshSession(batch, id) {
  batch.set(doc(db, "sessions", id), {
    ...seedSession, location: QUICK_NAME, createdAt: Date.now(),
    rules: { ...DEFAULT_RULES }, ruleDefaultsVersion: RULE_DEFAULTS_VERSION,
  });
  for (let i = 1; i <= seedSession.courts; i++) {
    batch.set(doc(db, "sessions", id, "courts", `court-${i}`), {
      courtNumber: i, start: Date.now(), teamA: [], teamB: [],
    });
  }
}

// The classic queue app, no login. The session is stored at sessions/{uid}, where
// uid is the visitor's own Firebase user: an anonymous one made automatically, or
// the real account they're already signed in with (never signed out). The data
// belongs to this browser; clearing site data starts a fresh session.
export function useClub() {
  const [club, setClub] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let latest = 0;
    return onAuthStateChanged(auth, async (user) => {
      const call = ++latest;
      if (!user) {
        // No one signed in: start a quiet anonymous session. This fires the callback again.
        try {
          await signInAnonymously(auth);
        } catch (err) {
          // Firebase reports "anonymous sign-in is switched off" under either code.
          setError(err.code === "auth/operation-not-allowed" || err.code === "auth/admin-restricted-operation"
            ? "Quick sessions need anonymous sign-in turned on for this project. Contact the admin."
            : authMessage(err));
        }
        return;
      }
      try {
        const ref = doc(db, "sessions", user.uid);
        let snap = await getDoc(ref);
        if (!snap.exists()) {
          const batch = writeBatch(db);
          createFreshSession(batch, user.uid);
          await batch.commit();
          snap = await getDoc(ref);
        }
        const data = snap.data();
        if (data?.ruleDefaultsVersion !== RULE_DEFAULTS_VERSION) {
          await updateDoc(ref, {
            rules: { ...DEFAULT_RULES, ...data?.rules, avoidRepeatPartners: true },
            ruleDefaultsVersion: RULE_DEFAULTS_VERSION,
          });
        }
        if (call !== latest) return; // a newer auth change already resolved
        setError("");
        setClub({ id: user.uid, name: snap.data()?.location || QUICK_NAME });
      } catch {
        if (call === latest) setError("Couldn't start your session. Check your connection and reload the page.");
      }
    });
  }, []);

  // Closes out today's play: archives aggregate stats (if any games were played),
  // clears the match log and costs, empties every court, and resets every player's
  // stats and checks them all out. The roster stays; this is not "New Session".
  async function endSession() {
    if (!club) return;
    const { id } = club;
    const [playersSnap, courtsSnap, matchLogSnap, costsSnap, sessionSnap] = await Promise.all([
      getDocs(collection(db, "sessions", id, "players")),
      getDocs(collection(db, "sessions", id, "courts")),
      getDocs(collection(db, "sessions", id, "matchLog")),
      getDocs(collection(db, "sessions", id, "costs")),
      getDoc(doc(db, "sessions", id)),
    ]);
    const roster = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const totalGames = roster.reduce((n, p) => n + (p.games || 0), 0);
    const batch = writeBatch(db);
    if (totalGames > 0) {
      const historyRef = doc(collection(db, "sessions", id, "history"));
      batch.set(historyRef, {
        endedAt: Date.now(),
        matches: matchCount(roster, sessionSnap.data()?.format),
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
    costsSnap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // Erases everything in this session (players, courts, history, costs, match log)
  // and starts a blank one. No undo.
  async function eraseSession() {
    if (!club) return;
    const { id } = club;
    for (const name of SUBCOLLECTIONS) await wipeCollection(db, collection(db, "sessions", id, name));
    const batch = writeBatch(db);
    createFreshSession(batch, id);
    await batch.commit();
  }

  return { club, error, endSession, eraseSession };
}
