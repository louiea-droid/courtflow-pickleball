import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import PageTitle from "../components/PageTitle";
import Select from "../components/Select";

const VISIBILITY = [
  { value: "public", label: "Public: listed, anyone can book" },
  { value: "private", label: "Private: members only" },
];

// The create-club form. onCreate resolves to { id } (go to the new club) or { error } (show it).
export default function CreateClub({ onCreate, navigate }) {
  const [form, setForm] = useState({ name: "", description: "", location: "", visibility: "public" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (change) => setForm((f) => ({ ...f, ...change }));

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await onCreate(form);
    if (result.error) {
      setError(result.error);
      setBusy(false);
    } else {
      navigate(`/clubs/${result.id}`);
    }
  };

  return (
    <div className="page-narrow">
      <a className="back-link" href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}><ArrowLeft size={14} /> My clubs</a>
      <PageTitle title="Create a club" sub="You'll be the owner. You can change everything later in the club's settings." />
      <form className="panel club-form" onSubmit={submit}>
        <label>
          Club name
          <input value={form.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Centro Pickle Club" autoFocus required />
        </label>
        <label>
          Description <small>(optional)</small>
          <textarea rows={3} value={form.description} maxLength={500} onChange={(e) => set({ description: e.target.value })} placeholder="Who plays, when, and at what level." />
        </label>
        <label>
          Location <small>(optional)</small>
          <input value={form.location} maxLength={100} onChange={(e) => set({ location: e.target.value })} placeholder="City or venue" />
        </label>
        <label>
          Who can see it
          <Select value={form.visibility} onChange={(visibility) => set({ visibility })} options={VISIBILITY} />
        </label>
        {error && <p className="op-error" role="alert">{error}</p>}
        <div className="modalactions">
          <button type="button" className="outline" onClick={() => navigate("/")}>Cancel</button>
          <button className="primary" disabled={busy || !form.name.trim()}>{busy ? "Creating…" : "Create club"}</button>
        </div>
      </form>
    </div>
  );
}
