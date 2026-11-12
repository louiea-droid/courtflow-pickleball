import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import Modal from "./Modal";
import ClubBadge from "./ClubBadge";
import ClubProfileSettings from "./ClubProfileSettings";
import Wave from "./Wave";
import { badgeColor } from "../utils/clubs";
import { photoUrl } from "../utils/clubPhoto";

// One "Change ..." button with its own hidden file picker. A picked file saves at once.
function PickButton({ label, busy, onPick, className = "outline" }) {
  const input = useRef(null);
  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => input.current?.click()}>
        <Camera size={15} /> {busy ? "Saving…" : label}
      </button>
      <input ref={input} type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
    </>
  );
}

// Edit club: the cover and the club photo (each saves when picked or removed), then the club's name, description, place and
// (owner) visibility through the same form as Settings.
export default function EditClubModal({ clubId, club, isOwner, cover, photo, onClose, onSaveProfile, setClubPhoto, setClubCover, notify }) {
  const [busy, setBusy] = useState(""); // "" | "cover" | "photo"
  const [error, setError] = useState("");
  const run = async (what, fn, done) => {
    setBusy(what);
    setError("");
    try { await fn(); notify(done); } catch (err) { setError(err?.message?.startsWith("Choose") || err?.message?.startsWith("That") ? err.message : "Couldn't save. Check your connection and try again."); }
    setBusy("");
  };
  const shownPhoto = photo || club.photo || "";

  return (
    <Modal title="Edit club" label={club.name} close={onClose} className="edit-club-modal">
      <div className="edit-club-cover" style={cover ? { backgroundImage: photoUrl(cover) } : { "--club": badgeColor(clubId) }}>
        {!cover && <Wave className="club-cover-wave" />}
        <div className="edit-club-cover-btns">
          <PickButton label="Change cover" className="glass-btn" busy={busy === "cover"}
            onPick={(f) => run("cover", () => setClubCover(clubId, f), "Cover updated.")} />
          {cover && (
            <button type="button" className="glass-btn" disabled={!!busy} aria-label="Remove cover"
              onClick={() => run("cover", () => setClubCover(clubId, null), "Cover removed.")}><Trash2 size={15} /></button>
          )}
        </div>
      </div>
      <div className="edit-club-photo">
        <ClubBadge className="club-head-photo" id={clubId} name={club.name} photo={shownPhoto} />
        <PickButton label="Change photo" busy={busy === "photo"}
          onPick={(f) => run("photo", () => setClubPhoto(clubId, f), "Photo updated.")} />
        {shownPhoto && (
          <button type="button" className="outline muted" disabled={!!busy}
            onClick={() => run("photo", () => setClubPhoto(clubId, null), "Photo removed.")}>Remove</button>
        )}
      </div>
      <p className="edit-club-hint">Cover: a wide photo works best. Club photo: cropped square, shown in lists and the sidebar.</p>
      {error && <p className="op-error" role="alert">{error}</p>}
      <ClubProfileSettings club={club} isOwner={isOwner} onSave={onSaveProfile} />
    </Modal>
  );
}
