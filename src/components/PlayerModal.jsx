import { useState } from "react";
import Modal from "./Modal";
import StarRating from "./StarRating";

export default function PlayerModal({ close, submit, player }) {
  const isEdit = Boolean(player);
  const [name, setName] = useState(player?.name || "");
  const [skill, setSkill] = useState(player?.skill || 3);
  const [gender, setGender] = useState(player?.gender || "");
  const [checked, setChecked] = useState(player ? player.checked : true);

  return (
    <Modal title={isEdit ? "Edit Player" : "Add Player"} label={isEdit ? "PLAYER INFO" : "CHECK-IN"} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) submit({ name: name.trim(), skill: +skill, gender, checked });
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
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">Not specified</option>
              <option>M</option>
              <option>F</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          Checked in
        </label>
        <div className="modalactions">
          <button type="button" className="outline" onClick={close}>Cancel</button>
          <button className="primary">{isEdit ? "Save Changes" : "Add Player"}</button>
        </div>
      </form>
    </Modal>
  );
}
