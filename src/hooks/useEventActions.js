import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { addAttendee, splitAttendees } from "../utils/bookings";
import { EVENT_SUBCOLLECTIONS } from "../utils/accountData";
import { wipeCollection } from "../utils/wipe";

const norm = (s) => s.trim().toLowerCase();

// Every write a host can make to an event. The signed-in account owns all of these;
// players only ever create a pending request (public page), never touch an event.
// ponytail: attendees is one array updated read-modify-write, so two tabs editing the
// same event at once can overwrite each other. Fine for one host; move to per-attendee
// docs if staff accounts arrive.
export function useEventActions({ uid, events, hostName, timeZone, notify }) {
  const eventsCol = () => collection(db, "accounts", uid, "events");
  const eventRef = (id) => doc(db, "accounts", uid, "events", id);
  const requestRef = (eventId, requestId) => doc(db, "accounts", uid, "events", eventId, "requests", requestId);
  const find = (id) => events.find((e) => e.id === id);
  const setAttendees = (id, attendees) => updateDoc(eventRef(id), { attendees });

  // hostName and timeZone are copied onto the event so the public page can show them
  // without reading the private account doc. Renaming the club later doesn't rewrite old events.
  const save = async (id, data) => {
    if (id) {
      await updateDoc(eventRef(id), data);
      notify("Open play updated.");
      return id;
    }
    const created = await addDoc(eventsCol(), {
      ...data, attendees: [], status: "scheduled", hostName, timeZone, createdAt: Date.now(),
    });
    notify("Open play created.");
    return created.id;
  };

  // Requests live under the event, so wipe them before the event doc goes.
  const remove = async (id) => {
    for (const name of EVENT_SUBCOLLECTIONS) await wipeCollection(db, collection(eventRef(id), name));
    await deleteDoc(eventRef(id));
    notify("Open play deleted.");
  };

  const add = async (eventId, name) => {
    const e = find(eventId);
    const clean = name.trim();
    if (!e || !clean) return;
    if ((e.attendees || []).some((a) => norm(a.name) === norm(clean))) return notify(`${clean} is already on the list.`);
    const attendee = { id: crypto.randomUUID(), name: clean, paid: "unpaid", method: "cash", joinedAt: Date.now() };
    const next = addAttendee(e.attendees || [], attendee);
    await setAttendees(eventId, next);
    const waiting = splitAttendees({ ...e, attendees: next }).waitlist.some((a) => a.id === attendee.id);
    notify(waiting ? `${clean} is on the waitlist.` : `${clean} added.`);
  };

  const patch = (eventId, attendeeId, change) => {
    const e = find(eventId);
    return setAttendees(eventId, e.attendees.map((a) => (a.id === attendeeId ? { ...a, ...change } : a)));
  };

  const setPaid = (eventId, attendeeId, paid) =>
    patch(eventId, attendeeId, { paid, ...(paid === "paid" ? { paidAt: Date.now() } : {}) });

  const kick = async (eventId, attendeeId) => {
    const e = find(eventId);
    const before = splitAttendees(e).confirmed.map((a) => a.id);
    const next = e.attendees.filter((a) => a.id !== attendeeId);
    const promoted = splitAttendees({ ...e, attendees: next }).confirmed.find((a) => !before.includes(a.id));
    await setAttendees(eventId, next);
    notify(promoted ? `${promoted.name} moved up from the waitlist.` : "Removed from the list.");
  };

  // The attendee id is the request id, so the player's own page can find their seat.
  const approve = async (eventId, request) => {
    const e = find(eventId);
    if (!e) return notify("That open play no longer exists.");
    const attendee = {
      id: request.id, name: request.name, method: request.method, paid: "unpaid", joinedAt: request.createdAt,
      ...(request.ref ? { ref: request.ref } : {}),
    };
    const next = addAttendee((e.attendees || []).filter((a) => a.id !== request.id), attendee);
    const batch = writeBatch(db);
    batch.update(eventRef(eventId), { attendees: next });
    batch.update(requestRef(eventId, request.id), { status: "approved" });
    await batch.commit();
    const waiting = splitAttendees({ ...e, attendees: next }).waitlist.some((a) => a.id === request.id);
    notify(waiting ? `${request.name} approved, on the waitlist.` : `${request.name} confirmed.`);
  };

  const decline = async (eventId, request) => {
    await updateDoc(requestRef(eventId, request.id), { status: "declined" });
    notify(`${request.name} declined.`);
  };

  return { save, remove, add, setPaid, patch, kick, approve, decline };
}
