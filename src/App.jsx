import { useEffect, useMemo, useState } from "react";
import {
  addDoc, collection, doc, setDoc, updateDoc, deleteDoc, writeBatch, getDocs,
} from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";
import { winPct } from "./utils/format";
import { matchesCourtLevel } from "./utils/courtLevels";
import { selectForCourt, splitTeams } from "./utils/rotationModes";
import { useSessionData } from "./hooks/useSessionData";
import { useClub } from "./hooks/useClub";
import { useCosts } from "./hooks/useCosts";
import { useMatchLog } from "./hooks/useMatchLog";

import ClubLogin from "./components/ClubLogin";
import ClubSessionChoice from "./components/ClubSessionChoice";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Toast from "./components/Toast";
import PlayerModal from "./components/PlayerModal";
import SessionModal from "./components/SessionModal";
import ShareModal from "./components/ShareModal";
import ConfirmDialog from "./components/ConfirmDialog";
import Dashboard from "./views/Dashboard";
import Queue from "./views/Queue";
import Players from "./views/Players";
import Cost from "./views/Cost";
import Stats from "./views/Stats";
import Guide from "./views/Guide";

export default function App() {
  const {
    club, loginClub, endSession: signOutClub, loggingIn,
    pendingClub, confirmContinue, confirmNewSession, cancelPendingClub,
  } = useClub();
  const SESSION_ID = club?.id;
  const [tab, setTab] = useState("dashboard");
  const { session, players, courts, busy } = useSessionData(SESSION_ID);
  const costs = useCosts(SESSION_ID);
  const matchLog = useMatchLog(SESSION_ID);
  const [showPlayer, setShowPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showSession, setShowSession] = useState(false);
  const [showEditSession, setShowEditSession] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showEndSession, setShowEndSession] = useState(false);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cf-sidebar-collapsed") === "1");

  useEffect(() => {
    localStorage.setItem("cf-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const autoRotateOn = session.autoRotate !== false;
  const mode = session.mode || session.rotation || "Balanced";

  useEffect(() => {
    const locked = showPlayer || Boolean(editingPlayer) || showSession || showEditSession || menuOpen;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPlayer, editingPlayer, showSession, showEditSession, menuOpen]);

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

  const notify = (m, ms = 2200) => { setToast(m); setTimeout(() => setToast(""), ms); };

  async function addPlayer(data) {
    const id = crypto.randomUUID();
    await setDoc(doc(db, "sessions", SESSION_ID, "players", id), {
      id, ...data, games: 0, wins: 0, losses: 0, createdAt: Date.now(), checkedAt: Date.now(),
    });
    setShowPlayer(false);
    notify(`${data.name} joined the queue.`);
  }

  async function updatePlayerInfo(id, data) {
    const { lockedWithId, ...fields } = data;
    const current = players.find((p) => p.id === id);
    const batch = writeBatch(db);
    batch.update(doc(db, "sessions", SESSION_ID, "players", id), fields);
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
      batch.update(doc(db, "sessions", SESSION_ID, "players", oldPartnerId), { lockedWithId: null });
    }
    if (newPartnerId) {
      const newPartner = players.find((p) => p.id === newPartnerId);
      if (newPartner?.lockedWithId && newPartner.lockedWithId !== player.id) {
        batch.update(doc(db, "sessions", SESSION_ID, "players", newPartner.lockedWithId), { lockedWithId: null });
      }
      batch.update(doc(db, "sessions", SESSION_ID, "players", newPartnerId), { lockedWithId: player.id });
    }
    batch.update(doc(db, "sessions", SESSION_ID, "players", player.id), { lockedWithId: newPartnerId });
  }

  async function deletePlayer(id) {
    const p = players.find((x) => x.id === id);
    const batch = writeBatch(db);
    batch.delete(doc(db, "sessions", SESSION_ID, "players", id));
    if (p?.lockedWithId) {
      batch.update(doc(db, "sessions", SESSION_ID, "players", p.lockedWithId), { lockedWithId: null });
    }
    await batch.commit();
    notify(`${p?.name || "Player"} removed.`);
  }

  async function checkInPlayer(id) {
    await updateDoc(doc(db, "sessions", SESSION_ID, "players", id), {
      checked: true, checkedAt: Date.now(),
    });
    notify(`${players.find((p) => p.id === id)?.name || "Player"} checked in.`);
  }

  async function checkOutPlayer(id) {
    await updateDoc(doc(db, "sessions", SESSION_ID, "players", id), { checked: false });
    notify(`${players.find((p) => p.id === id)?.name || "Player"} checked out.`);
  }

  async function callPlayer(id) {
    const need = session.format === "Singles" ? 2 : 4;
    const p = players.find((x) => x.id === id);
    const c = courts.find((x) => (x.teamA?.length || 0) + (x.teamB?.length || 0) < need
      && matchesCourtLevel(p?.skill, x.level));
    if (!c) return notify("No open court matches this player's level.");
    const a = [...(c.teamA || [])], b = [...(c.teamB || [])];
    if (need === 2) { if (!a.length) a.push(id); else b.push(id); }
    else if (a.length < 2) a.push(id);
    else b.push(id);
    await updateDoc(doc(db, "sessions", SESSION_ID, "courts", c.id), { teamA: a, teamB: b });
    notify(`Called ${players.find((p) => p.id === id)?.name || "player"} to Court ${c.courtNumber}.`);
  }

  async function removePlayer(courtId, id) {
    const c = courts.find((x) => x.id === courtId);
    await updateDoc(doc(db, "sessions", SESSION_ID, "courts", courtId), {
      teamA: c.teamA.filter((x) => x !== id), teamB: c.teamB.filter((x) => x !== id),
    });
    await updateDoc(doc(db, "sessions", SESSION_ID, "players", id), { checkedAt: Date.now() });
    notify("Player returned to queue.");
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
    if (oldPlayer?.lockedWithId && onCourtNow.has(oldPlayer.lockedWithId)) {
      return notify(`${oldPlayer.name} is locked in with ${nameOf(oldPlayer.lockedWithId)} — can't swap them out this match.`, 4000);
    }
    if (newPlayer?.lockedWithId && !onCourtNow.has(newPlayer.lockedWithId)) {
      return notify(`${newPlayer.name} is locked in with ${nameOf(newPlayer.lockedWithId)} — can't add them without their partner.`, 4000);
    }
    const inTeamA = (c.teamA || []).includes(oldId);
    const teamA = inTeamA ? c.teamA.map((x) => (x === oldId ? newId : x)) : c.teamA;
    const teamB = !inTeamA ? c.teamB.map((x) => (x === oldId ? newId : x)) : c.teamB;
    const batch = writeBatch(db);
    batch.update(doc(db, "sessions", SESSION_ID, "courts", courtId), { teamA, teamB });
    batch.update(doc(db, "sessions", SESSION_ID, "players", oldId), { checkedAt: Date.now() });
    await batch.commit();
    notify(`Swapped in ${newPlayer?.name || "Player"}.`);
  }

  // Standalone lock/unlock action for the one-click Queue lock button — reuses
  // the same mutual-reassignment logic PlayerModal's "Lock in with" uses.
  async function setPlayerLock(id, newPartnerId) {
    const current = players.find((p) => p.id === id);
    if (!current) return;
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
    await updateDoc(doc(db, "sessions", SESSION_ID), { autoRotate: !autoRotateOn });
    notify(`Auto-rotation ${!autoRotateOn ? "enabled" : "disabled"}.`);
  }

  async function changeMode(newMode) {
    await updateDoc(doc(db, "sessions", SESSION_ID), { mode: newMode });
    notify(`Mode set to ${newMode}.`);
  }

  async function startNextMatch(courtId) {
    const need = session.format === "Singles" ? 2 : 4;
    const c = courts.find((x) => x.id === courtId);
    const { taken: next } = selectForCourt({ pool: queue, court: c, mode, need });
    if (next.length < need) {
      if (next.length === 0 && queue.length > 0) {
        return notify("Not enough matching players are checked in yet for this court/mode.");
      }
      const label = c?.level && c.level !== "Any Level" ? `${c.level.toLowerCase()} ` : "";
      return notify(`Waiting on ${need - next.length} more ${label}player(s) to check in.`);
    }
    const [teamA, teamB] = splitTeams(next, mode);
    await updateDoc(doc(db, "sessions", SESSION_ID, "courts", courtId), { teamA, teamB, start: Date.now() });
    notify(`Court ${c?.courtNumber ?? ""} match started.`);
  }

  async function sendPreviewToCourt(teamAIds, teamBIds) {
    const openCourt = courts.find((c) => (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0);
    if (!openCourt) return notify("No court is open right now.");
    await updateDoc(doc(db, "sessions", SESSION_ID, "courts", openCourt.id), {
      teamA: teamAIds, teamB: teamBIds, start: Date.now(),
    });
    notify(`Sent to Court ${openCourt.courtNumber}.`);
  }

  async function setCourtLevel(courtId, level) {
    await updateDoc(doc(db, "sessions", SESSION_ID, "courts", courtId), { level });
    const c = courts.find((x) => x.id === courtId);
    notify(`Court ${c?.courtNumber ?? ""} set to ${level}.`);
  }

  async function renameCourt(courtId, name) {
    await updateDoc(doc(db, "sessions", SESSION_ID, "courts", courtId), { name });
    notify(name ? `Court renamed to ${name}.` : "Court name reset to default.");
  }

  async function skipQueuedPlayer(id) {
    await updateDoc(doc(db, "sessions", SESSION_ID, "players", id), { checkedAt: Date.now() });
    notify("Sent to the back of the queue.");
  }

  async function swapQueueOrder(idA, idB) {
    const a = players.find((p) => p.id === idA);
    const b = players.find((p) => p.id === idB);
    if (!a || !b) return;
    const batch = writeBatch(db);
    batch.update(doc(db, "sessions", SESSION_ID, "players", idA), { checkedAt: b.checkedAt || Date.now() });
    batch.update(doc(db, "sessions", SESSION_ID, "players", idB), { checkedAt: a.checkedAt || Date.now() });
    await batch.commit();
    notify(`Swapped ${a.name} and ${b.name} in the queue.`);
  }

  async function addCourt() {
    const nextNumber = courts.length + 1;
    const batch = writeBatch(db);
    batch.set(doc(db, "sessions", SESSION_ID, "courts", `court-${nextNumber}`), {
      courtNumber: nextNumber, start: Date.now(), teamA: [], teamB: [],
    });
    batch.set(doc(db, "sessions", SESSION_ID), { courts: nextNumber }, { merge: true });
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
      batch.set(doc(db, "sessions", SESSION_ID, "courts", targetIds[i]), {
        courtNumber: i + 1,
        start: c.start ?? Date.now(),
        teamA: c.teamA || [],
        teamB: c.teamB || [],
        ...(c.level ? { level: c.level } : {}),
      });
    });
    courts.forEach((c) => {
      if (!targetIds.includes(c.id)) batch.delete(doc(db, "sessions", SESSION_ID, "courts", c.id));
    });
    batch.set(doc(db, "sessions", SESSION_ID), { courts: remaining.length }, { merge: true });
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
          const { taken, remaining } = selectForCourt({ pool, court: c, mode, need });
          if (taken.length === need) {
            pool = remaining;
            const [a, b] = splitTeams(taken, mode);
            teamA = a;
            teamB = b;
            filledAny = true;
          }
        } else {
          // Topping up a partially-filled court: just match the court's level.
          const { taken, remaining } = selectForCourt({ pool, court: c, mode: null, need: openSlots });
          pool = remaining;
          taken.forEach((p) => {
            if (need === 2) { if (!teamA.length) teamA.push(p.id); else teamB.push(p.id); }
            else if (teamA.length < 2) teamA.push(p.id);
            else teamB.push(p.id);
            filledAny = true;
          });
        }
      }
      if (teamA.length !== (c.teamA || []).length || teamB.length !== (c.teamB || []).length) {
        batch.update(doc(db, "sessions", SESSION_ID, "courts", c.id), {
          teamA, teamB, ...(wasEmpty ? { start: Date.now() } : {}),
        });
      }
    });
    if (!filledAny) return notify("All courts are full, or no waiting players match the open courts' levels.");
    await batch.commit();
    notify("Filled open seats from the queue.");
  }

  async function recordWin(courtId, side) {
    const c = courts.find((x) => x.id === courtId);
    const winners = side === "A" ? c.teamA : c.teamB;
    const losers = side === "A" ? c.teamB : c.teamA;
    const batch = writeBatch(db);
    const partnerOf = {};
    if (winners.length === 2) { partnerOf[winners[0]] = winners[1]; partnerOf[winners[1]] = winners[0]; }
    if (losers.length === 2) { partnerOf[losers[0]] = losers[1]; partnerOf[losers[1]] = losers[0]; }
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
      if (partnerOf[id]) update.partners = [...(p.partners || []).slice(-4), partnerOf[id]];
      batch.update(doc(db, "sessions", SESSION_ID, "players", id), update);
    });
    const nameOf = (id) => players.find((x) => x.id === id)?.name || "Player";
    batch.set(doc(collection(db, "sessions", SESSION_ID, "matchLog")), {
      court: c.name || `Court ${c.courtNumber}`,
      winners: winners.map(nameOf),
      losers: losers.map(nameOf),
      recordedAt: Date.now(),
    });
    const need = session.format === "Singles" ? 2 : 4;
    if (autoRotateOn) {
      const { taken: next } = selectForCourt({ pool: queue, court: c, mode, need });
      const [teamA, teamB] = splitTeams(next, mode);
      batch.update(doc(db, "sessions", SESSION_ID, "courts", c.id), { teamA, teamB, start: Date.now() });
    } else {
      batch.update(doc(db, "sessions", SESSION_ID, "courts", c.id), {
        teamA: [], teamB: [], start: Date.now(),
      });
    }
    await batch.commit();
    notify(`Court ${c.courtNumber} rotated.`);
  }

  async function newSession(data) {
    const matchLogSnap = await getDocs(collection(db, "sessions", SESSION_ID, "matchLog"));
    const batch = writeBatch(db);
    batch.set(doc(db, "sessions", SESSION_ID), data, { merge: true });
    courts.forEach((c) => batch.delete(doc(db, "sessions", SESSION_ID, "courts", c.id)));
    players.forEach((p) => batch.delete(doc(db, "sessions", SESSION_ID, "players", p.id)));
    matchLogSnap.forEach((d) => batch.delete(d.ref));
    for (let i = 1; i <= data.courts; i++) {
      batch.set(doc(db, "sessions", SESSION_ID, "courts", `court-${i}`), {
        courtNumber: i, start: Date.now(), teamA: [], teamB: [],
      });
    }
    await batch.commit();
    setShowSession(false);
    notify("New session started. Add players to get going.");
  }

  async function updateSessionSettings(data) {
    const batch = writeBatch(db);
    batch.set(doc(db, "sessions", SESSION_ID), data, { merge: true });
    if (data.courts > courts.length) {
      for (let i = courts.length + 1; i <= data.courts; i++) {
        batch.set(doc(db, "sessions", SESSION_ID, "courts", `court-${i}`), {
          courtNumber: i, start: Date.now(), teamA: [], teamB: [],
        });
      }
    } else if (data.courts < courts.length) {
      courts.filter((c) => c.courtNumber > data.courts)
        .forEach((c) => batch.delete(doc(db, "sessions", SESSION_ID, "courts", c.id)));
    }
    await batch.commit();
    setShowEditSession(false);
    notify("Session updated.");
  }

  async function addCostEntry({ label, rate, hours, courts: courtCount, playerIds }) {
    const total = Math.round(rate * hours * courtCount * 100) / 100;
    const perPerson = playerIds.length ? Math.round((total / playerIds.length) * 100) / 100 : 0;
    await addDoc(collection(db, "sessions", SESSION_ID, "costs"), {
      label: label || "Court", rate, hours, courts: courtCount, total, perPerson, playerIds,
      paid: Object.fromEntries(playerIds.map((id) => [id, false])),
      visibleOnLive: false,
      createdAt: Date.now(),
    });
    notify("Cost entry saved.");
  }

  async function toggleCostPaid(costId, playerId) {
    const entry = costs.find((c) => c.id === costId);
    if (!entry) return;
    await updateDoc(doc(db, "sessions", SESSION_ID, "costs", costId), {
      [`paid.${playerId}`]: !entry.paid?.[playerId],
    });
  }

  async function toggleCostLive(costId) {
    const entry = costs.find((c) => c.id === costId);
    if (!entry) return;
    await updateDoc(doc(db, "sessions", SESSION_ID, "costs", costId), {
      visibleOnLive: !entry.visibleOnLive,
    });
    notify(entry.visibleOnLive ? "Hidden from Live Board." : "Now showing on Live Board.");
  }

  async function deleteCostEntry(costId) {
    await deleteDoc(doc(db, "sessions", SESSION_ID, "costs", costId));
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

  if (!club) {
    return (
      <>
        <ClubLogin onLogin={loginClub} loading={loggingIn} />
        {pendingClub && (
          <ClubSessionChoice
            clubName={pendingClub.name}
            loading={loggingIn}
            onContinue={confirmContinue}
            onNew={confirmNewSession}
            onCancel={cancelPendingClub}
          />
        )}
      </>
    );
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
        onNewSession={() => { setShowSession(true); setMenuOpen(false); }}
        onEditSession={() => { setShowEditSession(true); setMenuOpen(false); }}
        onEndSession={() => { setShowEndSession(true); setMenuOpen(false); }}
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
        />

        {!firebaseConfigured && (
          <div className="warning">
            Firebase is not configured. Copy <code>.env.example</code> to <code>.env</code>, enter your Firebase Web App values, then restart Vite.
          </div>
        )}

        <div className="view" key={tab}>
          {tab === "dashboard" && (
            <Dashboard session={session} players={players} courts={courts} queue={queue} matchLog={matchLog} notify={notify}
              recordWin={recordWin} removePlayer={removePlayer} swapPlayer={swapPlayer}
              autoRotateOn={autoRotateOn} onToggleAutoRotate={toggleAutoRotate} onAutoFill={autoFillCourts}
              onAddCourt={addCourt} onRemoveCourt={removeCourt} onSetCourtLevel={setCourtLevel} onRenameCourt={renameCourt}
              onStartNext={startNextMatch} onSwapQueueOrder={swapQueueOrder} onSkipQueued={skipQueuedPlayer}
              onEditPlayer={setEditingPlayer} onSendToCourt={sendPreviewToCourt}
              goQueue={() => setTab("queue")} />
          )}
          {tab === "queue" && (
            <Queue queue={queue} notCheckedIn={notCheckedIn} players={players}
              onCall={callPlayer} onCheckOut={checkOutPlayer} onCheckIn={checkInPlayer} onSetLock={setPlayerLock} />
          )}
          {tab === "players" && (
            <Players players={players} onEdit={setEditingPlayer} onDelete={deletePlayer} />
          )}
          {tab === "cost" && (
            <Cost
              players={players} costs={costs} onAdd={addCostEntry}
              onTogglePaid={toggleCostPaid} onToggleLive={toggleCostLive} onDelete={deleteCostEntry}
            />
          )}
          {tab === "stats" && <Stats players={players} exportCsv={exportCsv} sessionId={SESSION_ID} />}
          {tab === "guide" && <Guide />}
        </div>

        {(showPlayer || editingPlayer) && (
          <PlayerModal
            player={editingPlayer}
            players={players}
            close={() => { setShowPlayer(false); setEditingPlayer(null); }}
            submit={editingPlayer ? (data) => updatePlayerInfo(editingPlayer.id, data) : addPlayer}
          />
        )}
        {showSession && <SessionModal close={() => setShowSession(false)} submit={newSession} />}
        {showEditSession && (
          <SessionModal session={{ ...session, courts: courts.length }} close={() => setShowEditSession(false)} submit={updateSessionSettings} />
        )}
        {showShare && (
          <ShareModal url={`${window.location.origin}/live?club=${SESSION_ID}`} close={() => setShowShare(false)} />
        )}
        {showEndSession && (
          <ConfirmDialog
            title="End Session?"
            message={`This signs you out of ${session.location || club.name}. Your players and stats are kept — logging back in with this club name will continue the session with game counts reset to zero.`}
            confirmLabel="End Session"
            onCancel={() => setShowEndSession(false)}
            onConfirm={() => { setShowEndSession(false); signOutClub(); }}
          />
        )}
        <Toast message={toast} />
      </main>
    </div>
  );
}
