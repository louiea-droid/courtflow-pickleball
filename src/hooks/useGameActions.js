import { collection, deleteField, doc, getDoc, getDocs, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { eventBase } from "../utils/paths";
import { nowIn } from "../utils/bookings";
import { metaFor, sessionMeta } from "../utils/sessions";
import {
  bookingCostEntry, courtDocs, gameStartFields, playersToAdd, playNowEvent,
} from "../utils/gameSession";

// Every write that starts, extends, ends or reopens a game. The signed-in host owns all of it.
export function useGameActions({ clubId, club, hostName, timeZone, notify }) {
  const acct = club || {};
  const eventRef = (id) => doc(db, ...eventBase(clubId, id));
  const at = (id, ...rest) => doc(db, ...eventBase(clubId, id), ...rest);

  // First start: the event goes live, courts are created, the ticked players are added (not
  // checked in) and the booking fee gets one cost entry. On a live event ("Add to game") only
  // the players are added and the cost entry refreshed. Safe to repeat: players are matched by id.
  // The event and its players are read from Firestore here, not trusted from the screen, so a
  // stale tab can't reset players already in the game or restart an ended one. Resolves to true
  // when the game was started or extended, false when it was refused.
  const startGame = async (shown, pickedIds, uids = {}) => {
    const fresh = (await getDoc(eventRef(shown.id))).data();
    if (!fresh) { notify("That open play no longer exists."); return false; }
    if (fresh.status === "ended") { notify("This game has ended. Reopen it from the event page first.", 4000); return false; }
    const event = { ...fresh, id: shown.id };
    const players = (await getDocs(collection(db, ...eventBase(clubId, event.id), "players"))).docs.map((d) => ({ id: d.id }));
    const now = Date.now();
    const batch = writeBatch(db);
    if (event.status !== "live") {
      const fields = gameStartFields(acct, now);
      batch.update(eventRef(event.id), fields);
      courtDocs(fields.courts, now).forEach((c) => batch.set(at(event.id, "courts", c.id), c.data));
    }
    const added = playersToAdd(event, pickedIds, players, now, uids);
    added.forEach((p) => batch.set(at(event.id, "players", p.id), p));
    const costRef = at(event.id, "costs", `booking-${event.id}`);
    const existing = (await getDoc(costRef)).data() || null;
    const inGame = new Set([...players.map((p) => p.id), ...added.map((p) => p.id)]);
    const entry = bookingCostEntry(event, inGame, existing, now);
    if (entry) batch.set(costRef, entry);
    await batch.commit();
    notify(added.length ? `${added.length} added to the game.` : "Game started.");
    return true;
  };

  // An unscheduled event for today, live straight away. Resolves to the new event id.
  const playNow = async () => {
    const now = Date.now();
    const { date, hm } = nowIn(timeZone);
    const ref = doc(collection(db, "clubs", clubId, "events"));
    const event = playNowEvent({ account: acct, today: date, hm, timeZone, hostName, now });
    const batch = writeBatch(db);
    batch.set(ref, { ...event, ...metaFor(event, sessionMeta(clubId, club)) });
    courtDocs(event.courts, now).forEach((c) => batch.set(doc(ref, "courts", c.id), c.data));
    await batch.commit();
    return ref.id;
  };

  // Ending changes the status only. Players, matches and costs stay for the event page.
  const endGame = (eventId) => updateDoc(eventRef(eventId), { status: "ended", endedAt: Date.now() });

  const reopenGame = async (eventId) => {
    await updateDoc(eventRef(eventId), { status: "live", endedAt: deleteField() });
    notify("Game reopened.");
  };

  return { startGame, playNow, endGame, reopenGame };
}
