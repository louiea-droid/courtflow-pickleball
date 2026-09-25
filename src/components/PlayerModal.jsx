import { useState } from "react";
import Modal from "./Modal";
import Select from "./Select";
import StarRating from "./StarRating";

const GENDER_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "M" },
  { value: "F" },
];

export default function PlayerModal({ close, submit, player, players = [] }) {
  const isEdit = Boolean(player);
  const [name, setName] = useState(player?.name || "");
  const [skill, setSkill] = useState(player?.skill || 0);
  const [gender, setGender] = useState(player?.gender || "");
  const [checked, setChecked] = useState(player ? player.checked : true);
  const [lockedWithId, setLockedWithId] = useState(player?.lockedWithId || "");
  const [submitting, setSubmitting] = useState(false);

  const lockOptions = [
    { value: "", label: "No one (unlocked)" },
    ...players
      .filter((p) => p.id !== player?.id)
      .map((p) => ({
        value: p.id,
        label: p.lockedWithId && p.lockedWithId !== player?.id
          ? `${p.name} (locked with ${players.find((x) => x.id === p.lockedWithId)?.name || "someone"})`
          : p.name,
      })),
  ];

  return (
    <Modal title={isEdit ? "Edit Player" : "Add Player"} label={isEdit ? "PLAYER INFO" : "CHECK-IN"} close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (submitting || !name.trim()) return;
          setSubmitting(true);
          await submit({
            name: name.trim(), skill: +skill, gender, checked,
            ...(isEdit ? { lockedWithId: lockedWithId || null } : {}),
          });
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
        <div className="modalactions">
          <button type="button" className="outline" onClick={close}>Cancel</button>
          <button className="primary" disabled={submitting}>
            {isEdit ? "Save Changes" : "Add Player"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
