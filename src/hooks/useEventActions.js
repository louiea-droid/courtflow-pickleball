import { addDoc, collection, doc, getDoc, runTransaction, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { addAttendee, attendeeFromRequest, seatTaken, splitAttendees } from "../utils/bookings";
import { deleteEventData } from "../utils/accountData";
import { sessionMeta } from "../utils/sessions";

const norm = (s) => s.trim().toLowerCase();

// Every write a host can make to an event. The club's managers may make all of these;
// players only ever create a pending request (public page), never touch an event.
export function useEventActions({ clubId, club, events, hostName, timeZone, notify }) {
  // The club copy every event carries (Find session reads it); see utils/sessions.js.
  const meta = () => (club ? sessionMeta(clubId, club) : {});
  const eventsCol = () => collection(db, "clubs", clubId, "events");
  const eventRef = (id) => doc(db, "clubs", clubId, "events", id);
  const requestRef = (eventId, requestId) => doc(db, "clubs", clubId, "events", eventId, "requests", requestId);
  const find = (id) => events.find((e) => e.id === id);
  // Every change to the attendee list re-reads it in a transaction, so two managers acting at once never undo each
  // other (approving two requests at the same moment used to drop one). A transaction needs the server, so offline it
  // falls back to the list on screen in one batch, as before. edit(event) returns the new list, or a string: why
  // nothing changed (for the host). extra(writer, event, next) adds writes that go with it. Returns { e, next } or that string.
  // ponytail: offline, two managers can still overwrite each other's change; per-attendee docs would end that.
  const editAttendees = async (eventId, edit, extra = () => {}) => {
    const ref = eventRef(eventId);
    const apply = (w, e) => {
      const next = edit(e);
      if (typeof next === "string") return next;
      w.update(ref, { attendees: next });
      extra(w, e, next);
      return { e, next };
    };
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      try {
        return await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          return snap.exists() ? apply(tx, { id: eventId, ...snap.data() }) : "That open play no longer exists.";
        });
      } catch (err) {
        if (err?.code !== "unavailable") throw err;
      }
    }
    const e = find(eventId);
    if (!e) return "That open play no longer exists.";
    const batch = writeBatch(db);
    const out = apply(batch, e);
    if (typeof out !== "string") await batch.commit();
    return out;
  };

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
    const clean = name.trim();
    if (!clean) return;
    const attendee = { id: crypto.randomUUID(), name: clean, paid: "unpaid", method: "cash", joinedAt: Date.now() };
    const out = await editAttendees(eventId, (e) => ((e.attendees || []).some((a) => norm(a.name) === norm(clean))
      ? `${clean} is already on the list.` : addAttendee(e.attendees || [], attendee)));
    if (typeof out === "string") return notify(out);
    const waiting = splitAttendees({ ...out.e, attendees: out.next }).waitlist.some((a) => a.id === attendee.id);
    notify(waiting ? `${clean} is on the waitlist.` : `${clean} added.`);
  };

  const patch = (eventId, attendeeId, change) =>
    editAttendees(eventId, (e) => (e.attendees || []).map((a) => (a.id === attendeeId ? { ...a, ...change } : a)));

  // One write for any number of attendees (many separate writes would each start from the same stale list).
  const setPaidMany = async (eventId, ids, paid) => {
    if (!ids.length) return;
    const chosen = new Set(ids);
    const bookingRef = doc(db, "clubs", clubId, "events", eventId, "costs", `booking-${eventId}`);
    const booking = await getDoc(bookingRef);
    const at = Date.now();
    const out = await editAttendees(eventId, (e) => (e.attendees || []).map((a) => {
      if (!chosen.has(a.id)) return a;
      const next = { ...a, paid };
      // What they paid is kept (feeTotals reads it), so a later fee change doesn't rewrite money already collected.
      if (paid === "paid") Object.assign(next, { paidAt: at, amount: e.fee || 0 });
      else { delete next.paidAt; delete next.amount; }
      return next;
    }), (w) => {
      if (booking.exists()) ids.forEach((id) => w.update(bookingRef, { [`paid.${id}`]: paid === "paid" }));
    });
    if (typeof out === "string") notify(out);
  };
  const setPaid = (eventId, attendeeId, paid) => setPaidMany(eventId, [attendeeId], paid);

  const kick = async (eventId, attendeeId) => {
    // Still in the game: they stay on the Payment page as a game-only player, so their payment moves to the player doc.
    const playerRef = doc(db, "clubs", clubId, "events", eventId, "players", attendeeId);
    const inGame = find(eventId)?.status !== "scheduled" && (await getDoc(playerRef).catch(() => null))?.exists();
    const out = await editAttendees(eventId, (e) => (e.attendees || []).filter((a) => a.id !== attendeeId), (w, e) => {
      const gone = (e.attendees || []).find((a) => a.id === attendeeId);
      if (!inGame || !gone) return;
      const paid = gone.paid === "paid";
      w.update(playerRef, { feePaid: paid, feeMethod: gone.method || "cash", ...(paid ? { feeAmount: gone.amount ?? e.fee ?? 0 } : {}) });
    });
    if (typeof out === "string") return notify(out);
    const before = splitAttendees(out.e).confirmed.map((a) => a.id);
    const promoted = splitAttendees({ ...out.e, attendees: out.next }).confirmed.find((a) => !before.includes(a.id));
    notify(promoted ? `${promoted.name} moved up from the waitlist.` : "Removed from the list.");
  };

  // The attendee id is the request's seatId, so the player's own page can find their seat
  // without the public list revealing the request id (see attendeeFromRequest).
  const approve = async (eventId, request) => {
    const attendee = attendeeFromRequest(request);
    const out = await editAttendees(eventId, (e) => (seatTaken(e.attendees, request)
      ? `${request.name}'s request uses a spot that's already taken. Decline it.`
      : addAttendee((e.attendees || []).filter((a) => a.id !== attendee.id), attendee)),
    (w) => w.update(requestRef(eventId, request.id), { status: "approved" }));
    if (typeof out === "string") return notify(out);
    const waiting = splitAttendees({ ...out.e, attendees: out.next }).waitlist.some((a) => a.id === attendee.id);
    notify(waiting ? `${request.name} approved, on the waitlist.` : `${request.name} confirmed.`);
  };

  // The payment reference lives on the private request, never on the public event.
  const setRef = (eventId, requestId, ref) => updateDoc(requestRef(eventId, requestId), { ref });

  const decline = async (eventId, request) => {
    await updateDoc(requestRef(eventId, request.id), { status: "declined" });
    notify(`${request.name} declined.`);
  };

  // Court settings (courts, format, mode) only: no club copy, so a walk-in game (never public) can change them too.
  const setCourts = (eventId, change) => updateDoc(eventRef(eventId), change);

  return { save, remove, add, setPaid, setPaidMany, patch, kick, approve, decline, setRef, setCourts };
}
