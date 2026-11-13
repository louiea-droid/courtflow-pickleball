import { useRef, useState } from "react";
import { Check, Upload } from "lucide-react";
import Modal from "./Modal";
import { saveAvatar } from "./UserAvatar";
import { AVATARS } from "../data/avatars";
import { AVATAR_MAX, AVATAR_STEPS, avatarSrc } from "../utils/avatar";
import { compressImage } from "../utils/receipt";

// Your picture: upload a photo (center square, shrunk on the device) or tap a built-in one; each saves at once.
export default function AvatarPicker({ uid, current, onClose, notify }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (picture, done) => {
    setBusy(true);
    setError("");
    try {
      await saveAvatar(uid, await picture());
      notify(done);
      onClose();
    } catch (err) {
      setError(err?.message?.startsWith("Choose") || err?.message?.startsWith("That") ? err.message : "Couldn't save. Check your connection and try again.");
    }
    setBusy(false);
  };
  const upload = (file) => run(async () => ({
    image: await compressImage(file, {
      steps: AVATAR_STEPS, square: true, max: AVATAR_MAX,
      message: "Choose a picture for your profile.", tooLarge: "That picture is too large. Try another one.",
    }),
  }), "Picture updated.");

  return (
    <Modal title="Your picture" label="Profile" close={onClose} className="avatar-picker">
      <div className="avatar-picker-actions">
        <button type="button" className="primary" disabled={busy} onClick={() => input.current?.click()}><Upload size={15} /> {busy ? "Saving…" : "Upload photo"}</button>
        {current && <button type="button" className="outline" disabled={busy} onClick={() => run(async () => null, "Picture removed.")}>Remove</button>}
        <input ref={input} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
      </div>
      {error && <p className="op-error" role="alert">{error}</p>}
      <p className="avatar-picker-label">Or pick one</p>
      <div className="avatar-grid" role="radiogroup" aria-label="Built-in pictures">
        {AVATARS.map(([id, label]) => (
          <button key={id} type="button" role="radio" aria-checked={current === avatarSrc({ builtin: id })} aria-label={label} title={label}
            disabled={busy} onClick={() => run(async () => ({ builtin: id }), "Picture updated.")}>
            <img src={avatarSrc({ builtin: id })} alt="" />
            {current === avatarSrc({ builtin: id }) && <span className="avatar-grid-check"><Check size={14} strokeWidth={3} /></span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}
