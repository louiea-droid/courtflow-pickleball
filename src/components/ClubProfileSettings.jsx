import { useState } from "react";
import { validateClubInput } from "../utils/clubs";
import { SettingsRow } from "../views/Settings";
import Select from "./Select";

const VISIBILITY = [
  { value: "public", label: "Public: listed, anyone can book" },
  { value: "private", label: "Private: members only" },
];

// The club's name, description, location and visibility. Managers edit the text; only the owner
// changes visibility (the rules enforce the same).
export default function ClubProfileSettings({ club, isOwner, onSave }) {
  const [form, setForm] = useState({
    name: club.name, description: club.description || "", location: club.location || "", visibility: club.visibility,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (change) => setForm((f) => ({ ...f, ...change }));
  const dirty = form.name !== club.name || form.description !== (club.description || "")
    || form.location !== (club.location || "") || form.visibility !== club.visibility;

  const save = async (e) => {
    e.preventDefault();
    const problem = validateClubInput(form);
    if (problem) return setError(problem);
    setError("");
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(), description: form.description.trim(), location: form.location.trim(),
        ...(isOwner ? { visibility: form.visibility } : {}),
      });
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    }
    setSaving(false);
  };

  return (
    <form className="account-group" onSubmit={save}>
      <div className="eyebrow">Club</div>
      <div className="panel account-panel">
        <SettingsRow title="Name" body="Shown on the club page, the booking page and open play.">
          <input className="club-input" value={form.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} aria-label="Club name" />
        </SettingsRow>
        <SettingsRow title="Description" body="A few lines for people visiting the club.">
          <textarea className="club-input" rows={3} value={form.description} maxLength={500} onChange={(e) => set({ description: e.target.value })} aria-label="Description" />
        </SettingsRow>
        <SettingsRow title="Location" body="Where you play, for example a city or venue.">
          <input className="club-input" value={form.location} maxLength={100} onChange={(e) => set({ location: e.target.value })} aria-label="Location" />
        </SettingsRow>
        <SettingsRow
          title="Visibility"
          body={isOwner ? "Public clubs can be found and their open play booked by anyone. Private clubs are for members only." : "Only the owner can change this."}
        >
          <div className="account-select">
            <Select value={form.visibility} onChange={(visibility) => isOwner && set({ visibility })} options={VISIBILITY} />
          </div>
        </SettingsRow>
        {error && <p className="op-error" role="alert">{error}</p>}
        <div className="club-save">
          <button className="primary" disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </form>
  );
}
