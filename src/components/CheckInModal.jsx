import { useState } from "react";
import { isValidSkillLevel } from "../utils/courtLevels";
import Modal from "./Modal";
import StarRating from "./StarRating";

export default function CheckInModal({ player, close, submit }) {
  const [skill, setSkill] = useState(player.skill || 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const validSkill = isValidSkillLevel(skill);

  const save = async (e) => {
    e.preventDefault();
    if (busy || !validSkill) return;
    setBusy(true);
    setError("");
    try {
      await submit(skill);
    } catch {
      setError(`Couldn't check ${player.name} in. Check your connection and try again.`);
      setBusy(false);
    }
  };

  return (
    <Modal title="Set skill level" label="PLAYER CHECK-IN" close={close} className="checkin-skill-modal">
      <form className="checkin-skill-form" onSubmit={save}>
        <p className="checkin-skill-question">
          Ask <b>{player.name}</b> which level feels closest to their current game.
        </p>
        <div className="checkin-skill-choice">
          <span>Choose a level</span>
          <div role="group" aria-label="Choose skill level">
            <StarRating value={skill} onChange={(value) => { setSkill(value); setError(""); }} />
          </div>
        </div>
        <p className="checkin-skill-note">This is a self-rating. You can adjust it later from Players.</p>
        {error && <p className="op-error" role="alert">{error}</p>}
        <div className="modalactions">
          <button type="button" className="outline" onClick={close}>Cancel</button>
          <button className="primary" disabled={busy || !validSkill}>
            {busy ? "Checking in…" : "Save level & check in"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
