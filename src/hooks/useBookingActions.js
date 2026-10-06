import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { addAttendee, splitAttendees } from "../utils/bookings";

const norm = (s) => s.trim().toLowerCase();

// Every booking write the host can make. The signed-in club owns all of these;
// players only ever create a pending request (public page), never touch a booking.
export function useBookingActions({ clubId, players, bookings, requests, costs, notify }) {
  const col = (name) => collection(db, "sessions", clubId, name);
  const ref = (name, id) => doc(db, "sessions", clubId, name, id);
  const find = (id) => bookings.find((b) => b.id === id);
  const setAttendees = (id, attendees) => updateDoc(ref("bookings", id), { attendees });

  const save = async (id, data) => {
    if (id) await updateDoc(ref("bookings", id), data);
    else await addDoc(col("bookings"), { ...data, attendees: [], createdAt: Date.now() });
    notify(id ? "Open play updated." : "Open play created.");
  };

  const remove = async (id) => {
    const batch = writeBatch(db);
    batch.delete(ref("bookings", id));
    requests.filter((r) => r.bookingId === id).forEach((r) => batch.delete(ref("bookingRequests", r.id)));
    await batch.commit();
    notify("Open play deleted.");
  };

  // Typed a roster name → link the player; otherwise it's a walk-in by name only.
  const add = async (bookingId, name) => {
    const b = find(bookingId);
    const clean = name.trim();
    if (!b || !clean) return;
    if ((b.attendees || []).some((a) => norm(a.name) === norm(clean))) return notify(`${clean} is already on the list.`);
    const player = players.find((p) => norm(p.name) === norm(clean));
    const attendee = {
      id: crypto.randomUUID(), name: player?.name || clean, paid: "unpaid", method: "cash", joinedAt: Date.now(),
      ...(player ? { playerId: player.id } : {}),
    };
    const next = addAttendee(b.attendees || [], attendee);
    await setAttendees(bookingId, next);
    const waiting = splitAttendees({ ...b, attendees: next }).waitlist.some((a) => a.id === attendee.id);
    notify(waiting ? `${attendee.name} is on the waitlist.` : `${attendee.name} added.`);
  };

  const patch = (bookingId, attendeeId, change) => {
    const b = find(bookingId);
    return setAttendees(bookingId, b.attendees.map((a) => (a.id === attendeeId ? { ...a, ...change } : a)));
  };

  const setPaid = (bookingId, attendeeId, paid) => patch(bookingId, attendeeId, { paid, ...(paid === "paid" ? { paidAt: Date.now() } : {}) });

  const kick = async (bookingId, attendeeId) => {
    const b = find(bookingId);
    const before = splitAttendees(b).confirmed.map((a) => a.id);
    const next = b.attendees.filter((a) => a.id !== attendeeId);
    const promoted = splitAttendees({ ...b, attendees: next }).confirmed.find((a) => !before.includes(a.id));
    await setAttendees(bookingId, next);
    notify(promoted ? `${promoted.name} moved up from the waitlist.` : "Removed from the list.");
  };

  const approve = async (request) => {
    const b = find(request.bookingId);
    if (!b) return notify("That open play no longer exists.");
    const player = players.find((p) => norm(p.name) === norm(request.name));
    const attendee = {
      id: request.id, name: request.name, method: request.method, paid: "unpaid", joinedAt: request.createdAt,
      ...(request.ref ? { ref: request.ref } : {}),
      ...(player ? { playerId: player.id } : {}),
    };
    const next = addAttendee((b.attendees || []).filter((a) => a.id !== request.id), attendee);
    const batch = writeBatch(db);
    batch.update(ref("bookings", b.id), { attendees: next });
    batch.update(ref("bookingRequests", request.id), { status: "approved" });
    await batch.commit();
    const waiting = splitAttendees({ ...b, attendees: next }).waitlist.some((a) => a.id === request.id);
    notify(waiting ? `${request.name} approved, on the waitlist.` : `${request.name} confirmed.`);
  };

  const decline = async (request) => {
    await updateDoc(ref("bookingRequests", request.id), { status: "declined" });
    notify(`${request.name} declined.`);
  };

  const dismiss = (request) => deleteDoc(ref("bookingRequests", request.id));

  // Checks the confirmed players in to the queue (adding anyone new to the
  // roster) and logs what they owe on the Cost tab, carrying over who already paid.
  const start = async (bookingId) => {
    const b = find(bookingId);
    const { confirmed } = splitAttendees(b);
    if (!confirmed.length) return notify("Nobody is confirmed yet.");
    const now = Date.now();
    const batch = writeBatch(db);
    const playerOf = {};
    let checkedIn = 0;
    confirmed.forEach((a, i) => {
      const p = players.find((x) => x.id === a.playerId) || players.find((x) => norm(x.name) === norm(a.name));
      if (!p) {
        const id = crypto.randomUUID();
        playerOf[a.id] = id;
        batch.set(ref("players", id), {
          id, name: a.name, skill: 0, gender: "", checked: true, games: 0, wins: 0, losses: 0,
          createdAt: now, checkedAt: now + i,
        });
        checkedIn++;
      } else {
        playerOf[a.id] = p.id;
        if (!p.checked) {
          batch.update(ref("players", p.id), { checked: true, checkedAt: now + i });
          checkedIn++;
        }
      }
    });
    batch.update(ref("bookings", bookingId), {
      startedAt: now,
      attendees: b.attendees.map((a) => (playerOf[a.id] ? { ...a, playerId: playerOf[a.id] } : a)),
    });
    const fee = b.fee || 0;
    if (fee > 0 && !costs.some((c) => c.bookingId === bookingId)) {
      const playerIds = [...new Set(confirmed.map((a) => playerOf[a.id]))];
      const hours = (b.durationMins || 60) / 60;
      const total = fee * playerIds.length;
      batch.set(doc(col("costs")), {
        label: b.title, rate: total / hours, hours, courts: 1, total, perPerson: fee, playerIds, bookingId,
        paid: Object.fromEntries(playerIds.map((id) => [id, confirmed.some((a) => playerOf[a.id] === id && a.paid === "paid")])),
        visibleOnLive: false, createdAt: now,
      });
    }
    await batch.commit();
    notify(`${checkedIn} checked in from ${b.title}.`);
  };

  return { save, remove, add, setPaid, patch, kick, approve, decline, dismiss, start };
}
