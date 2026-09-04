import { useEffect, useMemo, useState } from "react";
import {
  doc, setDoc, updateDoc, deleteDoc, writeBatch,
} from "firebase/firestore";
import { db, firebaseConfigured } from "./firebase";
import { SESSION_ID } from "./data/constants";
import { winPct } from "./utils/format";
import { useSessionData } from "./hooks/useSessionData";

import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Toast from "./components/Toast";
import PlayerModal from "./components/PlayerModal";
import SessionModal from "./components/SessionModal";
import Dashboard from "./views/Dashboard";
import Queue from "./views/Queue";
import Players from "./views/Players";
import Stats from "./views/Stats";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const { session, players, courts, busy } = useSessionData();
  const [showPlayer, setShowPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showSession, setShowSession] = useState(false);
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const autoRotateOn = session.autoRotate !== false;

  useEffect(() => {
    const locked = showPlayer || Boolean(editingPlayer) || showSession || menuOpen;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [showPlayer, editingPlayer, showSession, menuOpen]);

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

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  async function addPlayer(data) {
    const id = crypto.randomUUID();
    await setDoc(doc(db, "sessions", SESSION_ID, "players", id), {
      id, ...data, games: 0, wins: 0, losses: 0, createdAt: Date.now(), checkedAt: Date.now(),
    });
    setShowPlayer(false);
    notify(`${data.name} joined the queue.`);
  }

  async function updatePlayerInfo(id, data) {
    await updateDoc(doc(db, "sessions", SESSION_ID, "players", id), data);
    setEditingPlayer(null);
    notify(`${data.name} updated.`);
  }

  async function deletePlayer(id) {
    const name = players.find((p) => p.id === id)?.name || "Player";
    await deleteDoc(doc(db, "sessions", SESSION_ID, "players", id));
    notify(`${name} removed.`);
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
    const c = courts.find((x) => (x.teamA?.length || 0) + (x.teamB?.length || 0) < need);
    if (!c) return notify("All courts are full.");
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
    const inTeamA = (c.teamA || []).includes(oldId);
    const teamA = inTeamA ? c.teamA.map((x) => (x === oldId ? newId : x)) : c.teamA;
    const teamB = !inTeamA ? c.teamB.map((x) => (x === oldId ? newId : x)) : c.teamB;
    const batch = writeBatch(db);
    batch.update(doc(db, "sessions", SESSION_ID, "courts", courtId), { teamA, teamB });
    batch.update(doc(db, "sessions", SESSION_ID, "players", oldId), { checkedAt: Date.now() });
    await batch.commit();
    const newName = players.find((p) => p.id === newId)?.name || "Player";
    notify(`Swapped in ${newName}.`);
  }

  async function toggleAutoRotate() {
    await updateDoc(doc(db, "sessions", SESSION_ID), { autoRotate: !autoRotateOn });
    notify(`Auto-rotation ${!autoRotateOn ? "enabled" : "disabled"}.`);
  }

  async function startNextMatch(courtId) {
    const need = session.format === "Singles" ? 2 : 4;
    if (queue.length < need) return notify(`Waiting on ${need - queue.length} more player(s) to check in.`);
    const next = queue.slice(0, need);
    await updateDoc(doc(db, "sessions", SESSION_ID, "courts", courtId), {
      teamA: next.slice(0, Math.ceil(need / 2)).map((p) => p.id),
      teamB: next.slice(Math.ceil(need / 2), need).map((p) => p.id),
      start: Date.now(),
    });
    const c = courts.find((x) => x.id === courtId);
    notify(`Court ${c?.courtNumber ?? ""} match started.`);
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

  async function autoFillCourts() {
    const need = session.format === "Singles" ? 2 : 4;
    const pool = [...queue];
    if (!pool.length) return notify("Queue is empty.");
    const batch = writeBatch(db);
    let filledAny = false;
    courts.forEach((c) => {
      const wasEmpty = (c.teamA?.length || 0) + (c.teamB?.length || 0) === 0;
      const teamA = [...(c.teamA || [])];
      const teamB = [...(c.teamB || [])];
      while (teamA.length + teamB.length < need && pool.length) {
        const id = pool.shift().id;
        if (need === 2) { if (!teamA.length) teamA.push(id); else teamB.push(id); }
        else if (teamA.length < 2) teamA.push(id);
        else teamB.push(id);
        filledAny = true;
      }
      if (teamA.length !== (c.teamA || []).length || teamB.length !== (c.teamB || []).length) {
        batch.update(doc(db, "sessions", SESSION_ID, "courts", c.id), {
          teamA, teamB, ...(wasEmpty ? { start: Date.now() } : {}),
        });
      }
    });
    if (!filledAny) return notify("All courts are full.");
    await batch.commit();
    notify("Filled open seats from the queue.");
  }

  async function recordWin(courtId, side) {
    const c = courts.find((x) => x.id === courtId);
    const winners = side === "A" ? c.teamA : c.teamB;
    const losers = side === "A" ? c.teamB : c.teamA;
    const batch = writeBatch(db);
    [...winners, ...losers].forEach((id) => {
      const p = players.find((x) => x.id === id);
      if (!p) return;
      batch.update(doc(db, "sessions", SESSION_ID, "players", id), {
        games: (p.games || 0) + 1,
        wins: (p.wins || 0) + (winners.includes(id) ? 1 : 0),
        losses: (p.losses || 0) + (losers.includes(id) ? 1 : 0),
        checkedAt: Date.now(),
      });
    });
    const need = session.format === "Singles" ? 2 : 4;
    if (autoRotateOn) {
      const next = queue.slice(0, need);
      batch.update(doc(db, "sessions", SESSION_ID, "courts", c.id), {
        teamA: next.slice(0, Math.ceil(need / 2)).map((p) => p.id),
        teamB: next.slice(Math.ceil(need / 2), need).map((p) => p.id),
        start: Date.now(),
      });
    } else {
      batch.update(doc(db, "sessions", SESSION_ID, "courts", c.id), {
        teamA: [], teamB: [], start: Date.now(),
      });
    }
    await batch.commit();
    notify(`Court ${c.courtNumber} rotated.`);
  }

  async function newSession(data) {
    const batch = writeBatch(db);
    batch.set(doc(db, "sessions", SESSION_ID), data, { merge: true });
    courts.forEach((c) => batch.delete(doc(db, "sessions", SESSION_ID, "courts", c.id)));
    players.forEach((p) => batch.delete(doc(db, "sessions", SESSION_ID, "players", p.id)));
    for (let i = 1; i <= data.courts; i++) {
      batch.set(doc(db, "sessions", SESSION_ID, "courts", `court-${i}`), {
        courtNumber: i, start: Date.now(), teamA: [], teamB: [],
      });
    }
    await batch.commit();
    setShowSession(false);
    notify("New session started. Add players to get going.");
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
        tab={tab}
        onSelectTab={selectTab}
        onNewSession={() => { setShowSession(true); setMenuOpen(false); }}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main>
        <Topbar
          tab={tab}
          onOpenMenu={() => setMenuOpen(true)}
          onShare={() => {
            navigator.clipboard?.writeText(`${session.location} — ${queue.length} waiting`);
            notify("Live board summary copied.");
          }}
        />

        {!firebaseConfigured && (
          <div className="warning">
            Firebase is not configured. Copy <code>.env.example</code> to <code>.env</code>, enter your Firebase Web App values, then restart Vite.
          </div>
        )}

        <div className="view" key={tab}>
          {tab === "dashboard" && (
            <Dashboard session={session} players={players} courts={courts} queue={queue}
              recordWin={recordWin} removePlayer={removePlayer} swapPlayer={swapPlayer}
              autoRotateOn={autoRotateOn} onToggleAutoRotate={toggleAutoRotate} onAutoFill={autoFillCourts}
              onStartNext={startNextMatch} onSwapQueueOrder={swapQueueOrder} onSkipQueued={skipQueuedPlayer}
              goQueue={() => setTab("queue")} />
          )}
          {tab === "queue" && (
            <Queue queue={queue} notCheckedIn={notCheckedIn} onAdd={() => setShowPlayer(true)}
              onCall={callPlayer} onCheckOut={checkOutPlayer} onCheckIn={checkInPlayer} />
          )}
          {tab === "players" && (
            <Players players={players} onAdd={() => setShowPlayer(true)} onEdit={setEditingPlayer} onDelete={deletePlayer} />
          )}
          {tab === "stats" && <Stats players={players} exportCsv={exportCsv} />}
        </div>

        {(showPlayer || editingPlayer) && (
          <PlayerModal
            player={editingPlayer}
            close={() => { setShowPlayer(false); setEditingPlayer(null); }}
            submit={editingPlayer ? (data) => updatePlayerInfo(editingPlayer.id, data) : addPlayer}
          />
        )}
        {showSession && <SessionModal close={() => setShowSession(false)} submit={newSession} />}
        <Toast message={toast} />
      </main>
    </div>
  );
}
