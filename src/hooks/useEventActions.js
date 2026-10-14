import { addDoc, collection, doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { addAttendee, attendeeFromRequest, splitAttendees } from "../utils/bookings";
import { deleteEventData } from "../utils/accountData";
import { sessionMeta } from "../utils/sessions";

const norm = (s) => s.trim().toLowerCase();

// Every write a host can make to an event. The club's managers may make all of these;
// players only ever create a pending request (public page), never touch an event.
// ponytail: attendees is one array updated read-modify-write, so two tabs editing the
// same event at once can overwrite each other. Fine for one host; move to per-attendee
// docs if staff accounts arrive.
export function useEventActions({ clubId, club, events, hostName, timeZone, notify }) {
  // The club copy every event carries (Find session reads it); see utils/sessions.js.
  const meta = () => (club ? sessionMeta(clubId, club) : {});
  const eventsCol = () => collection(db, "clubs", clubId, "events");
  const eventRef = (id) => doc(db, "clubs", clubId, "events", id);
  const requestRef = (eventId, requestId) => doc(db, "clubs", clubId, "events", eventId, "requests", requestId);
  const find = (id) => events.find((e) => e.id === id);
  const setAttendees = (id, attendees) => updateDoc(eventRef(id), { attendees });

  // hostName and timeZone are copied onto the event so the public page can show them
  // without reading the private account doc. Renaming the club later doesn't rewrite old events.
  const save = async (id, data) => {
    if (id) {
      await updateDoc(eventRef(id), { ...data, ...meta() });
      notify("Open play updated.");
      return id;
    }
    const created = await addDoc(eventsCol(), {
      ...data, attendees: [], status: "scheduled", hostName, timeZone, createdAt: Date.now(), ...meta(),
    });
    notify("Open play created.");
    return created.id;
  };

  const remove = async (id) => {
    await deleteEventData(db, clubId, id);
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

  // One write for any number of attendees (many separate writes would each start from the same stale list).
  const setPaidMany = async (eventId, ids, paid) => {
    const e = find(eventId);
    if (!e || !ids.length) return;
    const chosen = new Set(ids);
    const attendees = e.attendees.map((a) => {
      if (!chosen.has(a.id)) return a;
      const next = { ...a, paid };
      if (paid === "paid") next.paidAt = Date.now();
      else delete next.paidAt;
      return next;
    });
    const bookingRef = doc(db, "clubs", clubId, "events", eventId, "costs", `booking-${eventId}`);
    const booking = await getDoc(bookingRef);
    const batch = writeBatch(db);
    batch.update(eventRef(eventId), { attendees });
    if (booking.exists()) ids.forEach((id) => batch.update(bookingRef, { [`paid.${id}`]: paid === "paid" }));
    await batch.commit();
  };
  const setPaid = (eventId, attendeeId, paid) => setPaidMany(eventId, [attendeeId], paid);

  const kick = async (eventId, attendeeId) => {
    const e = find(eventId);
    const before = splitAttendees(e).confirmed.map((a) => a.id);
    const next = e.attendees.filter((a) => a.id !== attendeeId);
    const promoted = splitAttendees({ ...e, attendees: next }).confirmed.find((a) => !before.includes(a.id));
    await setAttendees(eventId, next);
    notify(promoted ? `${promoted.name} moved up from the waitlist.` : "Removed from the list.");
  };

  // The attendee id is the request's seatId, so the player's own page can find their seat
  // without the public list revealing the request id (see attendeeFromRequest).
  const approve = async (eventId, request) => {
    const e = find(eventId);
    if (!e) return notify("That open play no longer exists.");
    const attendee = attendeeFromRequest(request);
    const next = addAttendee((e.attendees || []).filter((a) => a.id !== attendee.id), attendee);
    const batch = writeBatch(db);
    batch.update(eventRef(eventId), { attendees: next });
    batch.update(requestRef(eventId, request.id), { status: "approved" });
    await batch.commit();
    const waiting = splitAttendees({ ...e, attendees: next }).waitlist.some((a) => a.id === attendee.id);
    notify(waiting ? `${request.name} approved, on the waitlist.` : `${request.name} confirmed.`);
  };

  // The payment reference lives on the private request, never on the public event.
  const setRef = (eventId, requestId, ref) => updateDoc(requestRef(eventId, requestId), { ref });

  const decline = async (eventId, request) => {
    await updateDoc(requestRef(eventId, request.id), { status: "declined" });
    notify(`${request.name} declined.`);
  };

  return { save, remove, add, setPaid, setPaidMany, patch, kick, approve, decline, setRef };
}
