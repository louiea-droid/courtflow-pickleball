import { useRef, useState } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { Mic, Play, Square, Trash2 } from "lucide-react";
import { db } from "../firebase";
import Modal from "./Modal";
import { PHRASES, canRecord, courtClipId, nameClipId, playClip, recordClip } from "../utils/voice";

const MAX_CHARS = 100000; // firestore.rules validClip

// Dashboard → Voice: record the words of a call in your own voice. A call plays the recorded pieces and the built-in
// voice says the rest. A game's recordings belong to its club (every game reuses them), a quick session keeps its own.
export default function VoiceModal({ voiceBase, clips, courts, players, isClub, close, notify }) {
  const [recording, setRecording] = useState(null); // the id being recorded
  const stopRef = useRef(null);
  const [search, setSearch] = useState("");

  const save = (id, label, audio) => setDoc(doc(db, ...voiceBase, "voice", id), { audio, label, at: Date.now() });
  const remove = (id) => deleteDoc(doc(db, ...voiceBase, "voice", id)).catch(() => notify("Couldn't delete that recording. Try again.", 4000));

  const record = async (id, label) => {
    if (recording) { stopRef.current?.(); return; }
    let rec;
    try {
      rec = await recordClip(4000);
    } catch {
      notify("Allow the microphone for this site to record.", 5000);
      return;
    }
    setRecording(id);
    stopRef.current = rec.stop;
    try {
      const audio = await rec.result;
      if (audio.length > MAX_CHARS) notify("That recording is too long. Keep it to a word or a name.", 4000);
      else { await save(id, label, audio); playClip(audio); }
    } catch {
      notify("Couldn't save the recording. Check your connection.", 4000);
    } finally {
      setRecording(null);
      stopRef.current = null;
    }
  };

  const row = (id, label, hint) => {
    const has = !!clips[id];
    const busy = recording === id;
    return (
      <div className={`voice-row${has ? " done" : ""}`} key={id}>
        <div className="voice-row-text">
          <b>{label}</b>
          <small>{busy ? "Recording… tap Stop when done" : has ? "Recorded" : hint || "Built-in voice"}</small>
        </div>
        <div className="voice-row-actions">
          {has && !busy && (
            <>
              <button type="button" className="icon" onClick={() => playClip(clips[id])} aria-label={`Play ${label}`} title="Play"><Play size={14} /></button>
              <button type="button" className="icon danger" onClick={() => remove(id)} aria-label={`Delete the recording of ${label}`} title="Delete"><Trash2 size={14} /></button>
            </>
          )}
          <button type="button" className={busy ? "primary voice-rec on" : "outline voice-rec"} disabled={!!recording && !busy}
            onClick={() => record(id, label)} aria-label={busy ? "Stop recording" : `Record ${label}`}>
            {busy ? <><Square size={13} /> Stop</> : <><Mic size={13} /> {has ? "Redo" : "Record"}</>}
          </button>
        </div>
      </div>
    );
  };

  const q = search.trim().toLowerCase();
  const people = [...players]
    .filter((p) => !q || p.name?.toLowerCase().includes(q))
    .sort((a, b) => Number(!!b.checked) - Number(!!a.checked) || a.name.localeCompare(b.name));
  const courtLabels = [...new Set(courts.map((c) => c.name || `Court ${c.courtNumber}`))];
  const countOf = (ids) => ids.filter((id) => clips[id]).length;

  return (
    <Modal title="Your voice" label="VOICE CALLS" close={close} className="voice-modal">
      <p className="voice-intro">
        Record each word once. Calls play your recordings, and the built-in voice says anything not recorded yet.
        {isClub ? " Saved for every game of this club." : " Saved for this session."} Keep each one short: a word or a name, up to 4 seconds.
      </p>
      {!canRecord() && <p className="modal-note warn">This browser can't record. Try Chrome on a phone or laptop.</p>}

      <div className="voice-group">
        <div className="eyebrow">Words <span>{countOf(PHRASES.map((p) => p.id))} of {PHRASES.length}</span></div>
        {PHRASES.map((p) => row(p.id, p.label))}
      </div>

      <div className="voice-group">
        <div className="eyebrow">Courts <span>{countOf(courtLabels.map(courtClipId))} of {courtLabels.length}</span></div>
        {courtLabels.map((label) => row(courtClipId(label), label))}
      </div>

      <div className="voice-group">
        <div className="eyebrow">Players <span>{countOf(players.map((p) => nameClipId(p.name)))} of {players.length}</span></div>
        {players.length > 6 && (
          <input type="search" className="voice-search" placeholder="Search players" aria-label="Search players" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
        {people.map((p) => row(nameClipId(p.name), p.name, p.sayAs ? `Built-in voice: “${p.sayAs}”` : null))}
        {!people.length && <p className="modal-note">{players.length ? "No players match." : "Add players to record their names."}</p>}
      </div>
    </Modal>
  );
}
