import { useState } from "react";
import {
  collection, doc, getDoc, getDocs, writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { seedSession } from "../data/constants";
import { slugifyClub, loadStoredClub, saveStoredClub } from "../utils/club";

async function createFreshSession(batch, id, clubName) {
  batch.set(doc(db, "sessions", id), { ...seedSession, location: clubName, createdAt: Date.now() });
  for (let i = 1; i <= seedSession.courts; i++) {
    batch.set(doc(db, "sessions", id, "courts", `court-${i}`), {
      courtNumber: i, start: Date.now(), teamA: [], teamB: [],
    });
  }
}

export function useClub() {
  const [club, setClub] = useState(loadStoredClub);
  const [loggingIn, setLoggingIn] = useState(false);
  // Set only when a typed-in club name already has a session — the login
  // screen asks the person to choose before anything is written.
  const [pendingClub, setPendingClub] = useState(null);

  function finishLogin(id, clubName) {
    const next = { id, name: clubName };
    saveStoredClub(next);
    setClub(next);
    setPendingClub(null);
  }

  async function loginClub(rawName) {
    const clubName = rawName.trim();
    if (!clubName) return;
    setLoggingIn(true);
    try {
      const id = slugifyClub(clubName);
      const existing = await getDoc(doc(db, "sessions", id));
      if (existing.exists()) {
        setPendingClub({ id, name: clubName });
        return;
      }
      const batch = writeBatch(db);
      await createFreshSession(batch, id, clubName);
      await batch.commit();
      finishLogin(id, clubName);
    } finally {
      setLoggingIn(false);
    }
  }

  // Keeps the roster, renews game counts. Whatever was played gets archived
  // first, so "renewed" doesn't mean "lost" — see Stats → Past Sessions.
  // The match log resets alongside the stats it recorded, so the Dashboard's
  // recent-matches feed doesn't mix leftover entries from the prior cycle in
  // with a roster that now reads zero games.
  async function confirmContinue() {
    if (!pendingClub) return;
    const { id, name } = pendingClub;
    setLoggingIn(true);
    try {
      const batch = writeBatch(db);
      const [playersSnap, matchLogSnap] = await Promise.all([
        getDocs(collection(db, "sessions", id, "players")),
        getDocs(collection(db, "sessions", id, "matchLog")),
      ]);
      const roster = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const totalGames = roster.reduce((n, p) => n + (p.games || 0), 0);
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
          games: 0, wins: 0, losses: 0, partners: [], lastResult: null,
        });
      });
      matchLogSnap.forEach((d) => batch.delete(d.ref));
      batch.set(doc(db, "sessions", id), { location: name }, { merge: true });
      await batch.commit();
      finishLogin(id, name);
    } finally {
      setLoggingIn(false);
    }
  }

  // Clears this club's roster, courts, and match log and starts over, same
  // as the in-app "New Session" action — just reachable straight from login.
  async function confirmNewSession() {
    if (!pendingClub) return;
    const { id, name } = pendingClub;
    setLoggingIn(true);
    try {
      const [playersSnap, courtsSnap, matchLogSnap] = await Promise.all([
        getDocs(collection(db, "sessions", id, "players")),
        getDocs(collection(db, "sessions", id, "courts")),
        getDocs(collection(db, "sessions", id, "matchLog")),
      ]);
      const batch = writeBatch(db);
      playersSnap.forEach((d) => batch.delete(d.ref));
      courtsSnap.forEach((d) => batch.delete(d.ref));
      matchLogSnap.forEach((d) => batch.delete(d.ref));
      await createFreshSession(batch, id, name);
      await batch.commit();
      finishLogin(id, name);
    } finally {
      setLoggingIn(false);
    }
  }

  function cancelPendingClub() {
    setPendingClub(null);
  }

  function endSession() {
    saveStoredClub(null);
    setClub(null);
  }

  return {
    club, loginClub, endSession, loggingIn,
    pendingClub, confirmContinue, confirmNewSession, cancelPendingClub,
  };
}
