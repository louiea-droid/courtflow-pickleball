import { useState } from "react";
import Modal from "./Modal";
import Select from "./Select";
import StarRating from "./StarRating";
import { hasGender, lockProblem } from "../utils/rotationModes";

const GENDER_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "M" },
  { value: "F" },
];

export default function PlayerModal({ close, submit, player, players = [], mode }) {
  const isEdit = Boolean(player);
  const [name, setName] = useState(player?.name || "");
  const [skill, setSkill] = useState(player?.skill || 0);
  const [gender, setGender] = useState(player?.gender || "");
  const [checked, setChecked] = useState(player ? player.checked : true);
  const [lockedWithId, setLockedWithId] = useState(player?.lockedWithId || "");
  const [submitting, setSubmitting] = useState(false);

  // Mixed Doubles only locks a man with a woman: others are listed but can't be picked.
  const mixed = mode === "Mixed Doubles";
  const me = { name: name.trim() || player?.name, gender };
  const lockOptions = [
    { value: "", label: "No one (unlocked)" },
    ...players
      .filter((p) => p.id !== player?.id)
      .map((p) => ({
        value: p.id,
        label: p.lockedWithId && p.lockedWithId !== player?.id
          ? `${p.name} (locked with ${players.find((x) => x.id === p.lockedWithId)?.name || "someone"})`
          : p.name,
        ...(mixed && lockProblem(me, p, mode)
          ? { disabled: true, tag: hasGender(me) && hasGender(p) ? "Same gender" : "No gender" }
          : {}),
      })),
  ];
  const partner = players.find((p) => p.id === lockedWithId);
  const lockWarning = mixed && partner ? lockProblem(me, partner, mode) : null;

  return (
    <Modal title={isEdit ? "Edit Player" : "Add Player"} label={isEdit ? "PLAYER INFO" : "CHECK-IN"} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting || !name.trim()) return;
          setSubmitting(true);
          try {
            await submit({
              name: name.trim(), skill: +skill, gender, checked,
              ...(isEdit ? { lockedWithId: lockedWithId || null } : {}),
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Santos"
            autoFocus
            required
          />
        </label>
        <div className="formgrid">
          <label>
            Skill
            <StarRating value={skill} onChange={setSkill} />
          </label>
          <label>
            Gender
            <Select value={gender} onChange={setGender} options={GENDER_OPTIONS} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          Checked in
        </label>
        {isEdit && (
          <label>
            Lock in with
            <Select value={lockedWithId} onChange={setLockedWithId} options={lockOptions} />
          </label>
        )}
        {isEdit && mixed && !lockWarning && <p className="modal-note">Mixed Doubles: lock a man with a woman only.</p>}
        {lockWarning && <p className="modal-note warn" role="alert">{lockWarning}</p>}
        <div className="modalactions">
          <button type="button" className="outline" onClick={close}>Cancel</button>
          <button className="primary" disabled={submitting || Boolean(lockWarning)}>
            {isEdit ? "Save Changes" : "Add Player"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
