import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Voice recordings (utils/voice.js) at {voiceBase}/voice: a club's (clubs/{id}) or a quick session's (sessions/{uid}).
// Returns { id: audio data URL }. A refused or failed read just means no recordings: calls use the built-in voice.
// ponytail: every recording is loaded (a few KB each); page them if a club ever records hundreds of names.
export function useVoiceClips(voiceBase, enabled = true) {
  const path = voiceBase && enabled ? voiceBase.join("/") : "";
  const [clips, setClips] = useState({});
  useEffect(() => {
    setClips({});
    if (!path) return undefined;
    return onSnapshot(collection(db, ...path.split("/"), "voice"),
      (s) => setClips(Object.fromEntries(s.docs.map((d) => [d.id, d.data().audio]))),
      () => setClips({}));
  }, [path]);
  return clips;
}

// Where a queue's recordings live: a game's belong to its club, a quick session keeps its own.
export const voiceBaseOf = (base) => (base?.[0] === "clubs" ? base.slice(0, 2) : base || null);
