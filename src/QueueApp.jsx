import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, doc, setDoc, updateDoc, deleteDoc, deleteField, writeBatch, getDocs, } from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";
import { applyDisplayPrefs, splitCost, winPct } from "./utils/format";
import { applyTheme, getGlobalTheme } from "./utils/theme";
import { matchCount } from "./utils/stats";
import { matchesCourtLevel } from "./utils/courtLevels";
import { checkInFields } from "./utils/gameSession";
import {
  hasGender, lockProblem, mixedLockProblems, mixedSideFor, mixedTeamAccepts, seatJoiners, selectForCourt, selectToJoin,
  shouldWinnersStay, splitTeams, trimHistory, validLock,
} from "./utils/rotationModes";
import { DEFAULT_COST, DEFAULT_DISPLAY, DEFAULT_LIVE, DEFAULT_RULES, normalizeMode } from "./data/constants";
import { useSessionData } from "./hooks/useSessionData";
import { useCosts } from "./hooks/useCosts";
import { useMatchLog } from "./hooks/useMatchLog";
import { useDocs } from "./hooks/useLiveDocs";
import { writeScore } from "./utils/umpireData";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Toast from "./components/Toast";
import PlayerModal from "./components/PlayerModal";
import CheckInModal from "./components/CheckInModal";
import SessionModal from "./components/SessionModal";
import ShareModal from "./components/ShareModal";
import ConfirmDialog from "./components/ConfirmDialog";
import Dashboard from "./views/Dashboard";
import Queue from "./views/Queue";
import Players from "./views/Players";
import Cost from "./views/Cost";
import Stats from "./views/Stats";
import Guide from "./views/Guide";
import Settings from "./views/Settings";

// The queue app on one session. `base` is the Firestore path of the document that holds it
// (utils/paths.js): the quick session at /club today. Every read and write goes through
// `at` (a document) and `col` (a collection) so the same code runs on any base.
// kind "event" is a game on an event: the session is derived from the event doc plus the account
// settings, there is no Settings tab, and End game keeps all data.
export default function QueueApp({
  base, kind = "quick", deriveSession, eyebrow, backLabel, onBack, onHome, onEndSession, onErase,
  onSetAttendeePaid, memberChoices,
}) {
  const at = (...rest) => doc(db, ...base, ...rest);
  const col = (name) => collection(db, ...base, name);
  const [tab, setTab] = useState("dashboard");
  const { session: rawSession, players, courts, busy } = useSessionData(base);
  const session = deriveSession ? deriveSession(rawSession) : rawSession;
  const noun = kind === "event" ? "game" : "session";
  const isEventGame = kind === "event";
  const costs = useCosts(base);
  const matchLog = useMatchLog(base);
  const claims = useDocs([...base, "courtClaims"]);
  const [showPlayer, setShowPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [checkingInPlayer, setCheckingInPlayer] = useState(null);
  const [showSession, setShowSession] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showEndSession, setShowEndSession] = useState(false);
  const [showErase, setShowErase] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cf-sidebar-collapsed") === "1");

  useEffect(() => {
    localStorage.setItem("cf-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const mode = normalizeMode(session.mode || session.rotation) || "Balanced";
  const mixed = mode === "Mixed Doubles";
  // Mixed Doubles teams are one man and one woman. Singles has no teams, so no pairing rule.
  const mixedTeams = mixed && session.format !== "Singles";
  // Custom: the host builds every match, so nothing rotates by itself.
  const autoRotateOn = session.autoRotate !== false && mode !== "Custom";
  const playersOf = (ids) => (ids || []).map((x) => players.find((q) => q.id === x)).filter(Boolean);
  const rules = { ...DEFAULT_RULES, ...session.rules };
  const costDefaults = { ...DEFAULT_COST, ...session.costDefaults };
  const live = { ...DEFAULT_LIVE, ...session.live };
  const savedDisplay = { ...DEFAULT_DISPLAY, ...session.display };
  const display = { ...savedDisplay, theme: getGlobalTheme() };
  applyDisplayPrefs(display);
  // Still loading, display is just the defaults; applying it would
  // flip the loading screen to Light and overwrite the cached theme.
  if (!busy) applyTheme(display);

  useEffect(() => {
    const locked = showPlayer || Boolean(editingPlayer) || Boolean(checkingInPlayer) || showSession || menuOpen;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPlayer, editingPlayer, checkingInPlayer, showSession, menuOpen]);

  const selectTab = (t) => { setTab(t); setMenuOpen(false); };

  const playing = useMemo(
    () => new Set(courts.flatMap((c) => [...(c.teamA || []), ...(c.teamB || [])])),
    [courts]
  );
  const queue = useMemo(
    () => players.filter((p) => p.checked && !playing.has(p.id))
      .sort((a, b) => a.games - b.games || a.checkedAt - b.checkedAt),
    [players, playing]
  );
  const notCheckedIn = useMemo(() => players.filter((p) => !p.checked), [players]);

  // action: optional { label, run } button (e.g. Undo). One timer, so an older
  // toast’s timeout never clears a newer one early.
  const notify = (message, ms = 2200, action = null) => {
    clearTimeout(toastTimer.current);
    setToast({ message, action });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const dismissToast = () => { clearTimeout(toastTimer.current); setToast(null); };

  async function addPlayer(data) {
    const id = crypto.randomUUID();
    await setDoc(at("players", id), {
      id, ...data, games: 0, wins: 0, losses: 0, createdAt: Date.now(), checkedAt: Date.now(),
    });
    setShowPlayer(false);
    notify(`${data.name} joined the queue.`);
  }

  async function updatePlayerInfo(id, data) {
    const { lockedWithId, ...fields } = data;
    const current = players.find((p) => p.id === id);
    if (lockedWithId) {
      const problem = mixed && lockProblem({ ...current, ...fields }, players.find((p) => p.id === lockedWithId), mode);
      if (problem) return notify(problem, 4500);
    }
    const batch = writeBatch(db);
    batch.update(at("players", id), fields);
    if (lockedWithId !== undefined && (lockedWithId || null) !== (current?.lockedWithId || null)) {
      applyLockChange(batch, current, lockedWithId || null);
    }
    await batch.commit();
    setEditingPlayer(null);
    notify(`${data.name} updated.`);
  }

  // Keeps the lock mutual: clears whoever the two players were previously
  // locked with (if anyone) before pointing them at each other.
  function applyLockChange(batch, player, newPartnerId) {
    const oldPartnerId = player?.lockedWithId || null;
    if (oldPartnerId && oldPartnerId !== newPartnerId) {
      batch.update(at("players", oldPartnerId), { lockedWithId: null });
    }
    if (newPartnerId) {
      const newPartner = players.find((p) => p.id === newPartnerId);
      if (newPartner?.lockedWithId && newPartner.lockedWithId !== player.id) {
        batch.update(at("players", newPartner.lockedWithId), { lockedWithId: null });
      }
      batch.update(at("players", newPartnerId), { lockedWithId: player.id });
    }
    batch.update(at("players", player.id), { lockedWithId: newPartnerId });
  }

  // A player who is deleted or checked out must not stay seated on a court (the court would count a ghost).
  function leaveCourts(batch, id) {
    courts.filter((c) => (c.teamA || []).includes(id) || (c.teamB || []).includes(id)).forEach((c) => {
      batch.update(at("courts", c.id), { teamA: (c.teamA || []).filter((x) => x !== id), teamB: (c.teamB || []).filter((x) => x !== id) });
    });
  }

  async function deletePlayer(id) {
    const p = players.find((x) => x.id === id);
    const batch = writeBatch(db);
    batch.delete(at("players", id));
    leaveCourts(batch, id);
    if (p?.lockedWithId) {
      batch.update(at("players", p.lockedWithId), { lockedWithId: null });
    }
    await batch.commit();
    notify(`${p?.name || "Player"} removed.`);
  }

  async function checkInPlayer(id, skill) {
    const player = players.find((p) => p.id === id);
    if (!player) return;
    if (isEventGame && skill === undefined) {
      setCheckingInPlayer(player);
      return;
    }
    const now = Date.now();
    const fields = isEventGame ? checkInFields(skill, now) : { checked: true, checkedAt: now };
    await updateDoc(at("players", id), fields);
    setCheckingInPlayer(null);
    notify(`${player.name} checked in.`);
  }

  async function checkOutPlayer(id) {
    const batch = writeBatch(db);
    batch.update(at("players", id), { checked: false });
    leaveCourts(batch, id);
    await batch.commit();
    notify(`${players.find((p) => p.id === id)?.name || "Player"} checked out.`);
  }

  async function callPlayer(id) {
    const need = session.format === "Singles" ? 2 : 4;
    const cap = need / 2;
    const p = players.find((x) => x.id === id);
    if (mixedTeams && !hasGender(p)) {
      return notify(`${p?.name || "This player"} has no gender set. Set it first to play Mixed Doubles.`, 4500);
    }
    // A locked partner who is waiting comes along, so the pair is never called apart.
    const mate = need === 4 && p?.lockedWithId ? queue.find((x) => x.id === p.lockedWithId && validLock(p, x, mode)) : null;
    const joiners = mate ? [p, mate] : [p];
    const free = (x) => need - (x.teamA?.length || 0) - (x.teamB?.length || 0);
    const sideFor = mixedTeams && !mate ? (q, A, B) => mixedSideFor(q, playersOf(A), playersOf(B)) : null;
    const c = courts.find((x) => free(x) >= joiners.length
      && joiners.every((q) => matchesCourtLevel(q.skill, x.level))
      && (!mate || [x.teamA, x.teamB].some((t) => cap - (t?.length || 0) >= 2))
      && (!sideFor || sideFor(p, x.teamA || [], x.teamB || [])));
    if (!c) {
      return notify(mate ? `No open court has room for ${p.name} and ${mate.name} together.`
        : mixedTeams ? "No open court has a team that needs this player's gender."
          : "No open court matches this player's level.");
    }
    const wasEmpty = free(c) === need;
    const [a, b] = seatJoiners(c.teamA || [], c.teamB || [], joiners, need, sideFor);
    const sideOf = (x) => (a.includes(x) ? a : b);
    if (p.lockedWithId && [...a, ...b].includes(p.lockedWithId) && sideOf(p.id) !== sideOf(p.lockedWithId)) {
      return notify(`${p.name} is locked in with ${players.find((x) => x.id === p.lockedWithId)?.name || "their partner"}, whose team is full.`, 4000);
    }
    await updateDoc(at("courts", c.id), { teamA: a, teamB: b, ...(wasEmpty ? { start: Date.now() } : {}) });
    notify(`Called ${joiners.map((q) => q.name).join(" and ")} to Court ${c.courtNumber}.`);
  }

  async function removePlayer(courtId, id) {
    const c = courts.find((x) => x.id === courtId);
    const p = players.find((x) => x.id === id);
    const onCourt = [...(c.teamA || []), ...(c.teamB || [])];
    // A locked pair leaves together: removing one would strand the other, who can't be added back alone.
    const mate = p?.lockedWithId && onCourt.includes(p.lockedWithId) ? p.lockedWithId : null;
    const gone = new Set([id, mate].filter(Boolean));
    const batch = writeBatch(db);
    batch.update(at("courts", courtId), { teamA: c.teamA.filter((x) => !gone.has(x)), teamB: c.teamB.filter((x) => !gone.has(x)) });
    gone.forEach((g) => batch.update(at("players", g), { checkedAt: Date.now() }));
    await batch.commit();
    notify(mate ? `${p.name} and ${players.find((x) => x.id === mate)?.name || "their partner"} returned to queue.` : "Player returned to queue.");
  }

  async function addPlayerToCourt(courtId, team, id) {
    const c = courts.find((x) => x.id === courtId);
    const player = players.find((p) => p.id === id);
    const key = team === "A" ? "teamA" : "teamB";
    const destTeamIds = new Set(c[key] || []);
    if (mixedTeams) {
      const fit = mixedTeamAccepts(player, playersOf(c[key]));
      if (!fit.ok) return notify(fit.reason, 4500);
    }
    // A locked pair must land on the same team — block if the partner isn't
    // already seated on this specific side (whether they're unseated or, worse,
    // seated on the opposing team, which would split the lock).
    let mate = null;
    if (player?.lockedWithId && !destTeamIds.has(player.lockedWithId)) {
      // The waiting partner comes along when this team has room for both.
      mate = queue.find((x) => x.id === player.lockedWithId && validLock(player, x, mode)
        && matchesCourtLevel(x.skill, c.level));
      const room = (session.format === "Singles" ? 1 : 2) - (c[key] || []).length;
      if (!mate || room < 2) {
        const partnerName = players.find((p) => p.id === player.lockedWithId)?.name || "their locked partner";
        return notify(`${player.name} is locked in with ${partnerName}, who can't join this team too (needs two free seats on the same team).`, 4000);
      }
    }
    const wasEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
    const added = mate ? [id, mate.id] : [id];
    const batch = writeBatch(db);
    batch.update(at("courts", courtId), { [key]: [...(c[key] || []), ...added], ...(wasEmpty ? { start: Date.now() } : {}) });
    added.forEach((a) => batch.update(at("players", a), { checkedAt: Date.now() }));
    await batch.commit();
    notify(`Added ${mate ? `${player.name} and ${mate.name}` : player?.name || "Player"} to Court ${c.courtNumber}.`);
  }

  async function swapPlayer(courtId, oldId, newId) {
    const c = courts.find((x) => x.id === courtId);
    const onCourtNow = new Set([...(c.teamA || []), ...(c.teamB || [])]);
    const nameOf = (id) => players.find((p) => p.id === id)?.name || "their locked partner";
    const oldPlayer = players.find((p) => p.id === oldId);
    const newPlayer = players.find((p) => p.id === newId);
    // A locked pair currently playing together can't be split by a manual
    // swap — unlock them first (Players tab or the Queue lock button) if you
    // really want to change one half.
    const oldMate = oldPlayer?.lockedWithId && onCourtNow.has(oldPlayer.lockedWithId) ? players.find((p) => p.id === oldPlayer.lockedWithId) : null;
    if (oldMate) {
      // A locked pair is swapped as a pair, for another locked pair that is waiting.
      const newMate = newPlayer?.lockedWithId && queue.find((x) => x.id === newPlayer.lockedWithId);
      if (!newMate || !validLock(newPlayer, newMate, mode) || !matchesCourtLevel(newMate.skill, c.level)) {
        return notify(`${oldPlayer.name} is locked in with ${oldMate.name}. Swap them for another waiting locked pair, or remove the pair first.`, 4500);
      }
      const swap = { [oldId]: newId, [oldMate.id]: newMate.id };
      const batch = writeBatch(db);
      batch.update(at("courts", courtId), { teamA: (c.teamA || []).map((x) => swap[x] || x), teamB: (c.teamB || []).map((x) => swap[x] || x) });
      [oldId, oldMate.id].forEach((g) => batch.update(at("players", g), { checkedAt: Date.now() }));
      await batch.commit();
      return notify(`Swapped in ${newPlayer.name} and ${newMate.name}.`);
    }
    const inTeamA = (c.teamA || []).includes(oldId);
    // Same rule as addPlayerToCourt: the incoming player's locked partner, if
    // seated, must be seated on the same team oldId is being swapped out of —
    // not just anywhere on the court.
    const destTeamIds = new Set(inTeamA ? c.teamA : c.teamB);
    if (newPlayer?.lockedWithId && !destTeamIds.has(newPlayer.lockedWithId)) {
      return notify(`${newPlayer.name} is locked in with ${nameOf(newPlayer.lockedWithId)} — can't add them without their partner on this team.`, 4000);
    }
    if (mixedTeams) {
      const fit = mixedTeamAccepts(newPlayer, playersOf((inTeamA ? c.teamA : c.teamB).filter((x) => x !== oldId)));
      if (!fit.ok) return notify(fit.reason, 4500);
    }
    const teamA = inTeamA ? c.teamA.map((x) => (x === oldId ? newId : x)) : c.teamA;
    const teamB = !inTeamA ? c.teamB.map((x) => (x === oldId ? newId : x)) : c.teamB;
    const batch = writeBatch(db);
    batch.update(at("courts", courtId), { teamA, teamB });
    batch.update(at("players", oldId), { checkedAt: Date.now() });
    await batch.commit();
    notify(`Swapped in ${newPlayer?.name || "Player"}.`);
  }

  // Standalone lock/unlock action for the one-click Queue lock button — reuses
  // the same mutual-reassignment logic PlayerModal's "Lock in with" uses.
  async function setPlayerLock(id, newPartnerId) {
    const current = players.find((p) => p.id === id);
    if (!current) return;
    if (newPartnerId) {
      const problem = mixed && lockProblem(current, players.find((p) => p.id === newPartnerId), mode);
      if (problem) return notify(problem, 4500);
    }
    const batch = writeBatch(db);
    applyLockChange(batch, current, newPartnerId || null);
    await batch.commit();
    if (newPartnerId) {
      const partnerName = players.find((p) => p.id === newPartnerId)?.name || "player";
      notify(`${current.name} locked in with ${partnerName}.`);
    } else {
      notify(`${current.name} unlocked.`);
    }
  }

  async function toggleAutoRotate() {
    await updateDoc(at(), { autoRotate: !autoRotateOn });
    notify(`Auto-rotation ${!autoRotateOn ? "enabled" : "disabled"}.`);
  }

  async function changeMode(newMode) {
    await updateDoc(at(), { mode: newMode });
    if (newMode === "Mixed Doubles") {
      const badLocks = mixedLockProblems(players).length;
      const noGender = players.filter((p) => p.checked && !hasGender(p)).length;
      const notes = [
        badLocks && `${badLocks} saved lock${badLocks === 1 ? "" : "s"} pair the same gender and will be ignored`,
        noGender && `${noGender} checked-in player${noGender === 1 ? " has" : "s have"} no gender set and won't be picked`,
      ].filter(Boolean);
      return notify(notes.length ? `Mode set to Mixed Doubles. ${notes.join("; ")}.` : "Mode set to Mixed Doubles.", notes.length ? 7000 : 2200);
    }
    if (newMode === "Custom") return notify("Custom: nothing is picked automatically. Add players to courts yourself.", 5000);
    notify(`Mode set to ${newMode}.`);
  }

  async function startNextMatch(courtId) {
    const need = session.format === "Singles" ? 2 : 4;
    const c = courts.find((x) => x.id === courtId);
    const { taken: next } = selectForCourt({ pool: queue, court: c, mode, need, now: Date.now() });
    if (next.length < need) {
      if (next.length === 0 && queue.length > 0) {
        return notify("Not enough matching players are checked in yet for this court/mode.");
      }
      const label = c?.level && c.level !== "Any Level" ? `${c.level.toLowerCase()} ` : "";
      return notify(`Waiting on ${need - next.length} more ${label}player(s) to check in.`);
    }
    const [teamA, teamB] = splitTeams(next, mode, rules.avoidRepeatPartners);
    await updateDoc(at("courts", courtId), { teamA, teamB, start: Date.now() });
    notify(`Court ${c?.courtNumber ?? ""} match started.`);
  }

  async function sendPreviewToCourt(teamAIds, teamBIds) {
    const openCourt = courts.find((c) => (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0);
    if (!openCourt) return notify("No court is open right now.");
    await updateDoc(at("courts", openCourt.id), {
      teamA: teamAIds, teamB: teamBIds, start: Date.now(),
    });
    notify(`Sent to Court ${openCourt.courtNumber}.`);
  }

  async function setCourtLevel(courtId, level) {
    await updateDoc(at("courts", courtId), { level });
    const c = courts.find((x) => x.id === courtId);
    notify(`Court ${c?.courtNumber ?? ""} set to ${level}.`);
  }

  async function renameCourt(courtId, name) {
    await updateDoc(at("courts", courtId), { name });
    notify(name ? `Court renamed to ${name}.` : "Court name reset to default.");
  }

  async function skipQueuedPlayer(id) {
    await updateDoc(at("players", id), { checkedAt: Date.now() });
    notify("Sent to the back of the queue.");
  }

  async function swapQueueOrder(idA, idB) {
    const a = players.find((p) => p.id === idA);
    const b = players.find((p) => p.id === idB);
    if (!a || !b) return;
    const batch = writeBatch(db);
    batch.update(at("players", idA), { checkedAt: b.checkedAt || Date.now() });
    batch.update(at("players", idB), { checkedAt: a.checkedAt || Date.now() });
    await batch.commit();
    notify(`Swapped ${a.name} and ${b.name} in the queue.`);
  }

  async function addCourt() {
    const nextNumber = courts.length + 1;
    const batch = writeBatch(db);
    batch.set(at("courts", `court-${nextNumber}`), {
      courtNumber: nextNumber, start: Date.now(), teamA: [], teamB: [],
    });
    batch.update(at(), { courts: nextNumber });
    await batch.commit();
    notify(`Court ${nextNumber} added.`);
  }

  async function removeCourt(courtId) {
    if (courts.length <= 1) return notify("You need at least 1 court.");
    const removed = courts.find((c) => c.id === courtId);
    // Re-pack the survivors into contiguous court-1..court-N doc IDs (keeping
    // their data) so numbering never gets gaps that later break addCourt.
    const remaining = courts.filter((c) => c.id !== courtId).sort((a, b) => a.courtNumber - b.courtNumber);
    const targetIds = remaining.map((_, i) => `court-${i + 1}`);
    const batch = writeBatch(db);
    remaining.forEach((c, i) => {
      batch.set(at("courts", targetIds[i]), {
        courtNumber: i + 1,
        start: c.start ?? Date.now(),
        teamA: c.teamA || [],
        teamB: c.teamB || [],
        ...(c.level ? { level: c.level } : {}),
      });
    });
    courts.forEach((c) => {
      if (!targetIds.includes(c.id)) batch.delete(at("courts", c.id));
    });
    batch.update(at(), { courts: remaining.length });
    await batch.commit();
    notify(`Court ${removed?.courtNumber ?? ""} removed.`);
  }

  async function autoFillCourts() {
    const need = session.format === "Singles" ? 2 : 4;
    let pool = [...queue];
    if (!pool.length) return notify("Queue is empty.");
    const batch = writeBatch(db);
    let filledAny = false;
    courts.forEach((c) => {
      const wasEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
      let teamA = [...(c.teamA || [])];
      let teamB = [...(c.teamB || [])];
      const openSlots = need - (teamA.length + teamB.length);
      if (openSlots > 0) {
        if (wasEmpty) {
          // Fresh match: let the session mode decide how the group is formed.
          const { taken, remaining } = selectForCourt({ pool, court: c, mode, need, now: Date.now() });
          if (taken.length === need) {
            pool = remaining;
            const [a, b] = splitTeams(taken, mode, rules.avoidRepeatPartners);
            teamA = a;
            teamB = b;
            filledAny = true;
          }
        } else {
          // Topping up a partially-filled court: just match the court's level.
          const seated = [...teamA, ...teamB].map((id) => players.find((p) => p.id === id)).filter(Boolean);
          // Only a seated player whose team still has a free seat can have a waiting locked partner pulled in beside them.
          const room = seated.filter((p) => (teamA.includes(p.id) ? teamA : teamB).length < need / 2);
          // ...and the waiting partner of a seated player on a full team is not picked at all (they'd land on the other team).
          const blocked = new Set(seated.filter((p) => p.lockedWithId && !room.includes(p)).map((p) => p.lockedWithId));
          const { taken } = selectToJoin({ pool: pool.filter((p) => !blocked.has(p.id)), court: c, seated, mode, need: openSlots, pullSeatedPartners: room });
          const pickedIds = new Set(taken.map((p) => p.id));
          pool = pool.filter((p) => !pickedIds.has(p.id));
          if (taken.length) {
            [teamA, teamB] = seatJoiners(teamA, teamB, taken, need,
              mixedTeams ? (p, A, B) => mixedSideFor(p, playersOf(A), playersOf(B)) : null);
            filledAny = true;
          }
        }
      }
      if (teamA.length !== (c.teamA || []).length || teamB.length !== (c.teamB || []).length) {
        batch.update(at("courts", c.id), {
          teamA, teamB, ...(wasEmpty ? { start: Date.now() } : {}),
        });
      }
    });
    if (!filledAny) return notify("All courts are full, or no waiting players match the open courts' levels.");
    await batch.commit();
    notify("Filled open seats from the queue.");
  }

  const scoreCourt = (courtId, score) => writeScore(base, courtId, score)
    .catch(() => notify("Couldn't save the score. Check your connection.", 4000));

  async function recordWin(courtId, side, scoreText = null) {
    const c = courts.find((x) => x.id === courtId);
    const winners = side === "A" ? c.teamA : c.teamB;
    const losers = side === "A" ? c.teamB : c.teamA;
    const batch = writeBatch(db);
    // What this result changes, so Undo can put it back exactly.
    const undo = writeBatch(db);
    const was = (v) => (v === undefined ? deleteField() : v);
    const partnerOf = {};
    if (winners.length === 2) { partnerOf[winners[0]] = winners[1]; partnerOf[winners[1]] = winners[0]; }
    if (losers.length === 2) { partnerOf[losers[0]] = losers[1]; partnerOf[losers[1]] = losers[0]; }
    const after = {}; // each player as the result leaves them, for the next pick
    [...winners, ...losers].forEach((id) => {
      const p = players.find((x) => x.id === id);
      if (!p) return;
      const update = {
        games: (p.games || 0) + 1,
        wins: (p.wins || 0) + (winners.includes(id) ? 1 : 0),
        losses: (p.losses || 0) + (losers.includes(id) ? 1 : 0),
        checkedAt: Date.now(),
        lastResult: winners.includes(id) ? "win" : "loss",
      };
      const hist = trimHistory(
        partnerOf[id] ? [...(p.partners || []), partnerOf[id]] : p.partners || [],
        [...(p.opponents || []), ...(winners.includes(id) ? losers : winners)], rules.historyGames);
      if (partnerOf[id]) update.partners = hist.partners;
      // Recent opponents too, so the next pick can avoid rematches.
      update.opponents = hist.opponents;
      after[id] = { ...p, ...update };
      batch.update(at("players", id), update);
      undo.update(at("players", id),
        Object.fromEntries(Object.keys(update).map((k) => [k, was(p[k])])));
    });
    const nameOf = (id) => players.find((x) => x.id === id)?.name || "Player";
    const logRef = doc(col("matchLog"));
    undo.delete(logRef);
    batch.set(logRef, {
      court: c.name || `Court ${c.courtNumber}`,
      winners: winners.map(nameOf),
      losers: losers.map(nameOf),
      recordedAt: Date.now(),
      ...(scoreText ? { score: scoreText } : {}),
    });
    const need = session.format === "Singles" ? 2 : 4;
    const courtRef = at("courts", c.id);
    undo.update(courtRef, {
      teamA: c.teamA || [], teamB: c.teamB || [], start: was(c.start),
      winStreak: was(c.winStreak), stayingIds: was(c.stayingIds), score: was(c.score),
    });
    // Winners-stay: count consecutive wins by the exact same team, and keep
    // them on until they hit the club's cap. Challengers come straight off
    // the front of the queue (court level still applies).
    const sameTeam = (c.stayingIds || []).length === winners.length
      && winners.every((id) => c.stayingIds.includes(id));
    const streak = sameTeam ? (c.winStreak || 0) + 1 : 1;
    const wantStay = shouldWinnersStay({ rules, mode, streak, winners });
    const capped = winners.length > 0 && !wantStay && streak >= rules.maxWinStreak && (rules.winnersStay || mode === "Winners / Losers");
    // Winners / Losers always brings the challengers on, whatever the auto-rotation switch says.
    const autoPick = autoRotateOn || mode === "Winners / Losers";
    const challengers = wantStay && autoPick
      ? selectToJoin({
        pool: queue, court: c, mode, need: need / 2, pullSeatedPartners: false,
        seated: winners.map((id) => players.find((p) => p.id === id)).filter(Boolean),
      }).taken.map((p) => p.id)
      : [];
    // No challenger can come on (e.g. nobody of the winners' level is waiting): rotate as normal
    // instead of leaving the winners on a court with an empty side.
    const stay = wantStay && (!autoPick || challengers.length === need / 2);
    if (stay) {
      batch.update(courtRef, {
        [side === "A" ? "teamA" : "teamB"]: winners,
        [side === "A" ? "teamB" : "teamA"]: challengers,
        start: Date.now(), winStreak: streak, stayingIds: winners,
      });
    } else if (autoRotateOn) {
      // With fewer than a full match waiting, the players who just finished queue up behind them.
      const now = Date.now();
      const finished = queue.length < need
        ? [...winners, ...losers].map((id) => after[id]).filter(Boolean)
        : [];
      const pool = [...queue, ...finished];
      const { taken: next } = selectForCourt({ pool, court: c, mode, need, now });
      const [teamA, teamB] = splitTeams(next, mode, rules.avoidRepeatPartners);
      batch.update(courtRef, { teamA, teamB, start: Date.now(), winStreak: 0, stayingIds: [] });
    } else {
      batch.update(courtRef, { teamA: [], teamB: [], start: Date.now(), winStreak: 0, stayingIds: [] });
    }
    // The result ends the match, so its live score goes with it.
    batch.update(courtRef, { score: deleteField() });
    await batch.commit();
    // ponytail: restores the court as it was; anything done to that court in the
    // 10s window (a swap, a manual add) is overwritten. Fine for a mis-tap fix.
    const undoResult = async () => {
      await undo.commit();
      notify(`Result on Court ${c.courtNumber} undone.`);
    };
    notify(
      stay ? `Winners stay on Court ${c.courtNumber} (${streak} in a row).`
        : capped ? `Court ${c.courtNumber}: ${streak} wins in a row, so the winners rest at the back of the queue.`
          : wantStay ? `Court ${c.courtNumber}: nobody matching is waiting to challenge, so the court rotated.`
            : `Court ${c.courtNumber} rotated.`,
      10000, { label: "Undo", run: undoResult },
    );
  }

  async function newSession(data) {
    const [matchLogSnap, costsSnap] = await Promise.all([
      getDocs(col("matchLog")),
      getDocs(col("costs")),
    ]);
    const batch = writeBatch(db);
    // Archive before the wipe, like End Session — otherwise
    // starting a new session from inside the app silently discards the
    // roster's game/win history instead of saving it to Stats → Past Sessions.
    const totalGames = players.reduce((n, p) => n + (p.games || 0), 0);
    if (totalGames > 0) {
      const historyRef = doc(col("history"));
      batch.set(historyRef, {
        endedAt: Date.now(),
        matches: matchCount(players, session.format),
        players: players.map((p) => ({
          id: p.id, name: p.name, games: p.games || 0, wins: p.wins || 0, losses: p.losses || 0,
        })),
      });
    }
    batch.set(at(), data, { merge: true });
    courts.forEach((c) => batch.delete(at("courts", c.id)));
    players.forEach((p) => batch.delete(at("players", p.id)));
    matchLogSnap.forEach((d) => batch.delete(d.ref));
    costsSnap.forEach((d) => batch.delete(d.ref));
    for (let i = 1; i <= data.courts; i++) {
      batch.set(at("courts", `court-${i}`), {
        courtNumber: i, start: Date.now(), teamA: [], teamB: [],
      });
    }
    await batch.commit();
    setShowSession(false);
    notify("New session started. Add players to get going.");
  }

  async function updateSessionSettings(data) {
    const batch = writeBatch(db);
    batch.set(at(), data, { merge: true });
    if (data.courts > courts.length) {
      for (let i = courts.length + 1; i <= data.courts; i++) {
        batch.set(at("courts", `court-${i}`), {
          courtNumber: i, start: Date.now(), teamA: [], teamB: [],
        });
      }
    } else if (data.courts < courts.length) {
      courts.filter((c) => c.courtNumber > data.courts)
        .forEach((c) => batch.delete(at("courts", c.id)));
    }
    await batch.commit();
    notify("Session updated.");
  }

  async function addCostEntry({ label, rate, hours, courts: courtCount, playerIds, perPerson }) {
    const total = Math.round(rate * hours * courtCount * 100) / 100;
    await addDoc(col("costs"), {
      label: label || "Court", rate, hours, courts: courtCount, total,
      perPerson: perPerson ?? splitCost(total, playerIds.length, costDefaults.roundTo),
      playerIds,
      paid: Object.fromEntries(playerIds.map((id) => [id, false])),
      visibleOnLive: false,
      createdAt: Date.now(),
    });
    notify("Cost entry saved.");
  }

  async function toggleCostPaid(costId, playerId) {
    const entry = costs.find((c) => c.id === costId);
    if (!entry) return;
    await updateDoc(at("costs", costId), {
      [`paid.${playerId}`]: !entry.paid?.[playerId],
    });
  }

  async function toggleCostLive(costId) {
    const entry = costs.find((c) => c.id === costId);
    if (!entry) return;
    await updateDoc(at("costs", costId), {
      visibleOnLive: !entry.visibleOnLive,
    });
    notify(entry.visibleOnLive ? "Hidden from Live Board." : "Now showing on Live Board.");
  }

  async function deleteCostEntry(costId) {
    await deleteDoc(at("costs", costId));
    notify("Cost entry removed.");
  }

  function exportCsv() {
    const rows = [
      ["Player", "Skill", "Games", "Wins", "Losses", "Win %"],
      ...players.map((p) => [p.name, p.skill, p.games, p.wins, p.losses, winPct(p)]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "courtflow-stats.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleErase() {
    setShowErase(false);
    try {
      await onErase();
      setTab("dashboard");
      notify("Session erased. You're starting fresh.");
    } catch {
      notify("Couldn't erase the session — please try again.", 4000);
    }
  }

  if (busy) {
    return (
      <div className="loading">
        <span className="spinner" />
        Loading CourtFlow…
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        session={session}
        courtCount={courts.length}
        mode={mode}
        onChangeMode={changeMode}
        tab={tab}
        onSelectTab={selectTab}
        onEndSession={() => { setShowEndSession(true); setMenuOpen(false); }}
        endLabel={kind === "event" ? "End game" : "End Session"}
        hiddenTabs={kind === "event" ? ["settings"] : []}
        backLink={kind === "event" ? { label: backLabel, onClick: onBack } : { label: "Back to home", onClick: onHome }}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <main>
        <Topbar
          tab={tab}
          onOpenMenu={() => setMenuOpen(true)}
          onShare={() => setShowShare(true)}
          onAddPlayer={() => setShowPlayer(true)}
          eyebrow={eyebrow}
          showShare={kind === "quick"}
        />

        {!firebaseConfigured && (
          <div className="warning">
            Firebase is not configured. Copy <code>.env.example</code> to <code>.env</code>, enter your Firebase Web App values, then restart Vite.
          </div>
        )}

        <div className="view" key={tab}>
          {tab === "dashboard" && (
            <Dashboard session={session} players={players} courts={courts} queue={queue} matchLog={matchLog} notify={notify}
              recordWin={recordWin} removePlayer={removePlayer} swapPlayer={swapPlayer} addPlayerToCourt={addPlayerToCourt}
              autoRotateOn={autoRotateOn} onToggleAutoRotate={toggleAutoRotate} onAutoFill={autoFillCourts}
              onAddCourt={addCourt} onRemoveCourt={removeCourt} onSetCourtLevel={setCourtLevel} onRenameCourt={renameCourt}
              onStartNext={startNextMatch} onSwapQueueOrder={swapQueueOrder} onSkipQueued={skipQueuedPlayer}
              onEditPlayer={setEditingPlayer} onSendToCourt={sendPreviewToCourt} rules={rules}
              claims={claims} onScore={scoreCourt}
              goQueue={() => setTab("queue")} />
          )}
          {tab === "queue" && (
            <Queue queue={queue} notCheckedIn={notCheckedIn} players={players} mixed={mixed}
              onCall={callPlayer} onCheckOut={checkOutPlayer} onCheckIn={checkInPlayer} onSetLock={setPlayerLock} />
          )}
          {tab === "players" && (
            <Players players={players} mixed={mixed} onEdit={setEditingPlayer} onDelete={deletePlayer} />
          )}
          {tab === "cost" && (
            <Cost
              players={players} costs={costs} onAdd={addCostEntry} costDefaults={costDefaults}
              onTogglePaid={toggleCostPaid} onToggleLive={toggleCostLive} onDelete={deleteCostEntry}
              isOpenPlay={isEventGame}
              attendees={isEventGame ? session.attendees || [] : []}
              eventFee={isEventGame ? session.fee || 0 : 0}
              maxPlayers={isEventGame ? session.maxPlayers : undefined}
              onSetAttendeePaid={isEventGame ? onSetAttendeePaid : undefined}
            />
          )}
          {isEventGame && checkingInPlayer && (
            <CheckInModal
              player={checkingInPlayer}
              close={() => setCheckingInPlayer(null)}
              submit={(skill) => checkInPlayer(checkingInPlayer.id, skill)}
            />
          )}
          {tab === "stats" && <Stats players={players} exportCsv={exportCsv} sessionId={kind === "quick" ? base[1] : null} format={session.format} />}
          {tab === "guide" && <Guide />}
          {tab === "settings" && kind === "quick" && (
            <Settings
              mode="quick" canChangePassword={false}
              session={session}
              onRenameClub={(location) => updateSessionSettings({ location })}
              onNewSession={() => setShowSession(true)}
              onDeleteAccount={() => setShowErase(true)}
              onSetDefaults={(defaults) => updateSessionSettings({ defaults })}
              rules={rules} costDefaults={costDefaults} live={live} display={display}
              onSetLive={(change) => updateSessionSettings({ live: { ...live, ...change } })}
              onSetDisplay={(change) => updateSessionSettings({ display: { ...savedDisplay, ...change } })}
              onSetRules={(change) => updateSessionSettings({ rules: { ...rules, ...change } })}
              onSetCostDefaults={(change) => updateSessionSettings({ costDefaults: { ...costDefaults, ...change } })}
            />
          )}
        </div>

        {(showPlayer || editingPlayer) && (
          <PlayerModal
            player={editingPlayer}
            players={players}
            mode={mode} memberChoices={memberChoices} requireSkillOnCheckIn={isEventGame}
            close={() => { setShowPlayer(false); setEditingPlayer(null); }}
            submit={editingPlayer ? (data) => updatePlayerInfo(editingPlayer.id, data) : addPlayer}
          />
        )}
        {showSession && (
          <SessionModal
            close={() => setShowSession(false)} submit={newSession}
            clubName={session.location} defaults={session.defaults}
          />
        )}
        {showShare && kind === "quick" && (
          <ShareModal url={`${window.location.origin}/live?club=${base[1]}${live.key ? `&key=${live.key}` : ""}`} close={() => setShowShare(false)} />
        )}
        {showErase && (
          <ConfirmDialog
            title="Erase this session?"
            message="This permanently deletes every player, court, match, cost and past-session record in this quick session and starts a blank one. There is no undo."
            confirmLabel="Erase everything"
            onCancel={() => setShowErase(false)}
            onConfirm={handleErase}
          />
        )}
        {showEndSession && (
          <ConfirmDialog
            title={kind === "event" ? "End game?" : "End Session?"}
            message={kind === "event"
              ? "This closes the game. Players, matches and costs stay saved on the event, and you can reopen it from the event page."
              : "This closes out today's play: stats are archived to Stats → Past Sessions, the match log and courts are cleared, and everyone will need to check in again next time. You'll go back to the home page afterwards."}
            confirmLabel={kind === "event" ? "End game" : "End Session"}
            onCancel={() => setShowEndSession(false)}
            onConfirm={() => {
              setShowEndSession(false);
              Promise.resolve(onEndSession())
                .then(() => {
                  if (kind === "quick") onHome();
                })
                .catch(() => notify(`Couldn't end the ${noun} — please try again.`, 4000));
            }}
          />
        )}
        <Toast toast={toast} onDismiss={dismissToast} />
      </main>
    </div>
  );
}
