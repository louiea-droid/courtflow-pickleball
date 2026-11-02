// Voice calls: the browser's own text-to-speech (Web Speech API) reads out who plays next, or the host's own
// recordings (Dashboard → Voice) where there are some. Pure parts are checked by `node src/utils/voice.check.mjs`;
// speak() / announce() only run in a browser.

const team = (names) => names.join(" and ");

// The name read out for a player: their "How to say it" spelling (`sayAs`, Edit Player) when set, else the name.
export const spokenName = (p) => (p?.sayAs || "").trim() || p?.name || "";

// kind "next": the Up Next card's Call button (court "" for a match that goes on the first court to free up).
// kind "start": a match just started on the court.
export function callText(kind, court, teamA = [], teamB = []) {
  const players = teamB.length ? `${team(teamA)}, versus ${team(teamB)}` : team(teamA);
  if (!players) return "";
  return kind === "start"
    ? `${court}: ${players}. Please go to ${court}.`
    : court ? `${court}, next up: ${players}. Please get ready.` : `Next up: ${players}. Please get ready.`;
}

// ---- Recordings. A recording's id says what it is: one of the fixed phrases, a court name or a player name
// (names are matched by spelling, so "Court 1" or "Ana Cruz" recorded once works in every game of the club).
export const PHRASES = [
  { id: "p_next-up", label: "next up" },
  { id: "p_and", label: "and" },
  { id: "p_versus", label: "versus" },
  { id: "p_get-ready", label: "Please get ready." },
  { id: "p_go-to", label: "Please go to" },
];
const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
export const courtClipId = (label) => `c_${encodeURIComponent(norm(label))}`;
export const nameClipId = (name) => `n_${encodeURIComponent(norm(name))}`;

// A call as pieces, in order: each has the recording it would use (`id`) and the words the built-in voice says
// when there is none (`text`). teamA / teamB are players ({ name, sayAs }).
export function callParts(kind, court, teamA = [], teamB = []) {
  const people = (t) => t.flatMap((p, i) => [
    ...(i ? [{ id: "p_and", text: "and" }] : []),
    { id: nameClipId(p.name), text: spokenName(p) },
  ]);
  if (!teamA.length && !teamB.length) return [];
  const where = { id: courtClipId(court), text: court };
  const match = [...people(teamA), ...(teamB.length ? [{ id: "p_versus", text: ", versus" }, ...people(teamB)] : [])];
  return kind === "start"
    ? [where, ...match, { id: "p_go-to", text: ". Please go to" }, where]
    : [...(court ? [where] : []), { id: "p_next-up", text: "next up" }, ...match, { id: "p_get-ready", text: ". Please get ready." }];
}

// Consecutive pieces without a recording are said in one breath by the built-in voice (their texts carry the pauses).
export function callRuns(parts, clips = {}) {
  const runs = [];
  for (const p of parts) {
    if (clips[p.id]) runs.push({ audio: clips[p.id] });
    else if (runs.at(-1)?.text != null) runs.at(-1).text += ` ${p.text}`;
    else runs.push({ text: p.text });
  }
  return runs;
}

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;
export const canRecord = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

// A short two-note chime before the words, so people look up.
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.18;
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch { /* no Web Audio: just the voice */ }
}

// The device's own default voice when it speaks English, else its first English voice. The list loads in the
// background, so the very first call can find it empty: that call gets the default voice too, so every call
// sounds the same (picking "the first English voice" made later calls switch to a quieter one).
let voices = [];
if (canSpeak()) {
  voices = window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => { voices = window.speechSynthesis.getVoices(); });
}
const pickVoice = () => voices.find((v) => v.default && /^en/i.test(v.lang)) || voices.find((v) => v.default) || null;
const utterance = (text) => {
  const say = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) say.voice = voice;
  say.rate = 0.95;
  say.volume = 1;
  return say;
};

export function speak(text) {
  if (!text || !canSpeak()) return false;
  chime();
  setTimeout(() => window.speechSynthesis.speak(utterance(text)), 550); // after the chime
  return true;
}

// Each step resolves when it has finished (or after a few seconds, so one stuck sound never stops the calls).
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = (start, ms) => Promise.race([new Promise(start), wait(ms)]);
const sayNow = (text) => (canSpeak()
  ? settle((done) => { const u = utterance(text); u.onend = done; u.onerror = done; window.speechSynthesis.speak(u); }, 4000 + text.length * 120)
  : Promise.resolve());
export const playClip = (src) => settle((done) => {
  const a = new Audio(src);
  a.onended = done; a.onerror = done;
  a.play().catch(done);
}, 8000);

// Calls queue up, so two arriving together are said one after the other.
let line = Promise.resolve();
export function announce(parts, clips, fallbackText) {
  if (!parts.some((p) => clips?.[p.id])) return speak(fallbackText);
  line = line.then(async () => {
    chime();
    await wait(550);
    for (const run of callRuns(parts, clips)) await (run.audio ? playClip(run.audio) : sayNow(run.text));
  }).catch(() => {});
  return true;
}

// A call from player ids (a court's teams), as the Dashboard and the Live Board both make it.
export function announceCall(kind, court, a = [], b = [], players = [], clips = {}) {
  const pick = (ids) => ids.map((id) => players.find((p) => p.id === id)).filter(Boolean);
  const [A, B] = [pick(a), pick(b)];
  return announce(callParts(kind, court, A, B), clips, callText(kind, court, A.map(spokenName), B.map(spokenName)));
}

// Records up to `maxMs` from the microphone; resolves with an audio data URL. stop() ends it early.
export async function recordClip(maxMs = 4000) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t));
  const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 24000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const result = new Promise((resolve, reject) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(new Blob(chunks, { type: rec.mimeType || type || "audio/webm" }));
    };
  });
  rec.start();
  const timer = setTimeout(() => rec.state !== "inactive" && rec.stop(), maxMs);
  return { result, stop: () => { clearTimeout(timer); if (rec.state !== "inactive") rec.stop(); } };
}
