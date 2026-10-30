import { useState } from "react";
import { deleteField } from "firebase/firestore";
import Modal from "./Modal";
import Select from "./Select";
import StarRating from "./StarRating";
import { isValidSkillLevel } from "../utils/courtLevels";
import { hasGender, lockProblem } from "../utils/rotationModes";
import { canSpeak, speak, spokenName } from "../utils/voice";
import { Volume2 } from "lucide-react";

const GENDER_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "M" },
  { value: "F" },
];

// `memberChoices` ([{ id, name }], club games only) lets the host tie a player to a club member, so the
// member's Home shows their place in the queue.
export default function PlayerModal({ close, submit, player, players = [], mode, memberChoices = [], requireSkillOnCheckIn = false }) {
  const isEdit = Boolean(player);
  const [name, setName] = useState(player?.name || "");
  const [skill, setSkill] = useState(player?.skill || 0);
  const [gender, setGender] = useState(player?.gender || "");
  const [sayAs, setSayAs] = useState(player?.sayAs || "");
  const [sayOpen, setSayOpen] = useState(false);
  const [checked, setChecked] = useState(player ? player.checked : true);
  const [lockedWithId, setLockedWithId] = useState(player?.lockedWithId || "");
  const [uid, setUid] = useState(player?.uid || "");
  const [skillError, setSkillError] = useState("");
  const pickMember = (id) => {
    setUid(id);
    const m = memberChoices.find((x) => x.id === id);
    if (m && !name.trim()) setName(m.name);
  };
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
          if (requireSkillOnCheckIn && checked && !isValidSkillLevel(skill)) {
            setSkillError("Choose a skill level before checking this player in.");
            return;
          }
          setSubmitting(true);
          try {
            await submit({
              name: name.trim(), skill: +skill, gender, checked,
              ...(uid ? { uid } : isEdit && player?.uid ? { uid: deleteField() } : {}),
              ...(sayAs.trim() ? { sayAs: sayAs.trim() } : isEdit && player?.sayAs ? { sayAs: deleteField() } : {}),
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
        {!sayOpen ? (
          <button type="button" className="say-as-link" onClick={() => setSayOpen(true)}>
            <Volume2 size={13} /> {sayAs.trim() ? <>Called as “{sayAs.trim()}” · Change</> : "How to say it (for voice calls)"}
          </button>
        ) : (
        <label>
          How to say it <small>(optional, for voice calls)</small>
          <div className="say-as">
            <input
              value={sayAs} onChange={(e) => setSayAs(e.target.value)} maxLength={60} autoFocus
              placeholder={name.trim() ? `Spell it as it sounds, e.g. "${name.trim()}"` : "Spell the name as it sounds"}
            />
            {canSpeak() && (
              <button type="button" className="outline" disabled={!sayAs.trim() && !name.trim()}
                onClick={() => speak(spokenName({ name: name.trim(), sayAs }))} aria-label="Hear how the name is called">
                <Volume2 size={14} /> Hear it
              </button>
            )}
          </div>
        </label>
        )}
        <div className="formgrid">
          <label>
            Skill
            <StarRating value={skill} onChange={(value) => { setSkill(value); setSkillError(""); }} />
          </label>
          <label>
            Gender
            <Select value={gender} onChange={setGender} options={GENDER_OPTIONS} />
          </label>
        </div>
        {(memberChoices.length > 0 || isEdit) && (
          <div className="player-links">
            {memberChoices.length > 0 && (
              <label>
                Club member
                <Select
                  value={uid} onChange={pickMember}
                  options={[{ value: "", label: "Not a member" }, ...memberChoices.map((m) => ({ value: m.id, label: m.name }))]}
                />
              </label>
            )}
            {isEdit && (
              <label>
                Lock in with
                <Select value={lockedWithId} onChange={setLockedWithId} options={lockOptions} />
              </label>
            )}
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={checked} onChange={(e) => { setChecked(e.target.checked); setSkillError(""); }} />
          Checked in
        </label>
        {skillError && <p className="modal-note warn" role="alert">{skillError}</p>}
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
