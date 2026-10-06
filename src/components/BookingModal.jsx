import { useState } from "react";
import Modal from "./Modal";
import Select from "./Select";
import { COURT_LEVEL_OPTIONS } from "../utils/courtLevels";

const DURATIONS = [60, 90, 120, 150, 180, 240].map((m) => ({
  value: m, label: `${m / 60} ${m === 60 ? "hour" : "hours"}`,
}));

export default function BookingModal({ close, submit, booking, today, lastPayInfo }) {
  const isEdit = Boolean(booking);
  const [title, setTitle] = useState(booking?.title || "Open play");
  const [date, setDate] = useState(booking?.date || today);
  const [startTime, setStartTime] = useState(booking?.startTime || "18:00");
  const [durationMins, setDurationMins] = useState(booking?.durationMins || 120);
  const [maxPlayers, setMaxPlayers] = useState(String(booking?.maxPlayers ?? 12));
  const [fee, setFee] = useState(booking ? String(booking.fee ?? "") : "");
  const [level, setLevel] = useState(booking?.level || "Any Level");
  const [payInfo, setPayInfo] = useState(booking?.payInfo ?? lastPayInfo ?? "");
  const [notes, setNotes] = useState(booking?.notes || "");
  const [submitting, setSubmitting] = useState(false);

  const max = parseInt(maxPlayers, 10);
  const valid = title.trim() && date && startTime && max >= 1;

  return (
    <Modal title={isEdit ? "Edit Open Play" : "New Open Play"} label="BOOKING" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting || !valid) return;
          setSubmitting(true);
          await submit({
            title: title.trim(), date, startTime, durationMins, maxPlayers: max,
            fee: Math.max(0, parseFloat(fee) || 0), level, payInfo: payInfo.trim(), notes: notes.trim(),
          });
        }}
      >
        <label>
          Name
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Saturday open play" autoFocus required />
        </label>
        <div className="formgrid">
          <label>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Start time
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </label>
        </div>
        <div className="formgrid">
          <label>
            How long
            <Select value={durationMins} onChange={setDurationMins} options={DURATIONS} />
          </label>
          <label>
            Level
            <Select value={level} onChange={setLevel} options={COURT_LEVEL_OPTIONS} />
          </label>
        </div>
        <div className="formgrid">
          <label>
            Player spots
            <input type="number" min="1" step="1" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} required />
          </label>
          <label>
            Fee per player (₱)
            <input type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0 for free" />
          </label>
        </div>
        <label>
          How to pay online
          <textarea
            value={payInfo} onChange={(e) => setPayInfo(e.target.value)} rows={2} maxLength={300}
            placeholder="GCash 0917 000 0000 (Name). Send the reference number when you join."
          />
        </label>
        <label>
          Notes for players
          <textarea
            value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300}
            placeholder="Bring your own paddle. Balls provided."
          />
        </label>
        <div className="modalactions">
          <button type="button" className="outline" onClick={close}>Cancel</button>
          <button className="primary" disabled={submitting || !valid}>{isEdit ? "Save Changes" : "Create Open Play"}</button>
        </div>
      </form>
    </Modal>
  );
}
