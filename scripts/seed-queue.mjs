// Seeds the local emulators with fake players that trigger the queue bugs (see scripts/queue-demo.mjs).
// Needs `npm run emulators` running. Usage: node scripts/seed-queue.mjs
// Then `npm run dev:emu`, sign in at http://localhost:5300 with a login below (password "password1"), open /club.
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x";
const FS = "http://127.0.0.1:8080/v1/projects/demo-courtflow/databases/(default)/documents";
const val = (v) => Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
  : v === null ? { nullValue: null }
  : typeof v === "number" ? { integerValue: String(v) } : typeof v === "string" ? { stringValue: v }
  : typeof v === "boolean" ? { booleanValue: v }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
const put = (path, data) => fetch(`${FS}/${path}`, { method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ fields: val(data).mapValue.fields }) })
  .then(async (r) => { if (!r.ok) throw new Error(`${path} ${await r.text()}`); });
const now = Date.now();

// [name, stars, gender, extra]; order = order they arrived (queue order, nobody has played yet unless `games` is set)
const SCENARIOS = {
  "sq1@demo.test": {
    title: "1+2: Skill Separated, 2 empty courts. Click Auto-fill.",
    session: { mode: "Skill Separated", courts: 2 },
    players: [["Eddie Expert", 6, "M"], ["Ian Int", 3, "M", { lock: "Ada Adv" }], ["Ivy Int", 3, "F"], ["Ike Int", 3, "M"], ["Ira Int", 3, "F"],
      ["Ada Adv", 5, "F", { lock: "Ian Int" }], ["Ann Adv", 5, "F"], ["Abe Adv", 5, "M"], ["Amy Adv", 5, "F"],
      ["Sam Int", 3, "M"], ["Lia Int", 3, "F"], ["Leo Int", 3, "M"]],
    courts: [],
  },
  "sq2@demo.test": {
    title: "3b: Balanced. Court 1 has Alan alone. Alan is locked with Dee. Click Auto-fill.",
    session: { mode: "Balanced", courts: 1 },
    players: [["Alan", 3, "M", { lock: "Dee", onCourt: "A" }], ["Pat", 3, "M"], ["Dee", 3, "F", { lock: "Alan" }], ["Quinn", 3, "F"]],
    courts: [],
  },
  "sq3@demo.test": {
    title: "5: Balanced, court 1 is playing, 1 waiting. Click the win button on Court 1.",
    session: { mode: "Balanced", courts: 1 },
    players: [["P1", 3, "M", { onCourt: "A" }], ["P2", 3, "F", { onCourt: "A" }], ["P3", 3, "M", { onCourt: "B" }], ["P4", 3, "F", { onCourt: "B" }], ["P5", 3, "M"]],
    courts: [],
  },
  "sq4@demo.test": {
    title: "4: Skill Separated + Winners stay on. Court 1 (3 star) plays. One 3 star waits. Record a win.",
    session: { mode: "Skill Separated", courts: 1, rules: { winnersStay: true, maxWinStreak: 3 } },
    players: [["W1", 3, "M", { onCourt: "A" }], ["W2", 3, "F", { onCourt: "A" }], ["X1", 3, "M", { onCourt: "B" }], ["X2", 3, "F", { onCourt: "B" }],
      ["Sam", 3, "M"], ["Tess", 5, "F"], ["Uma", 5, "M"], ["Vic", 5, "F"]],
    courts: [],
  },
};

// 30 fake players, 4 empty courts: switch the mode in the sidebar and use Auto-fill / the win buttons.
const ROSTER = [["Maria Santos", 3, "F"], ["Jose Reyes", 4, "M"], ["Ana Cruz", 2, "F"], ["Carlo Mendoza", 5, "M"], ["Liza Ramos", 3, "F"], ["Miguel Torres", 3, "M"],
  ["Bea Navarro", 1, "F"], ["Paolo Garcia", 4, "M"], ["Nina Aquino", 2, "F"], ["Rico Villanueva", 6, "M"], ["Joy Bautista", 3, "F"], ["Dante Lim", 3, "M"],
  ["Cathy Tan", 4, "F"], ["Ramon Dizon", 2, "M"], ["Tessa Gomez", 5, "F"], ["Ben Castillo", 3, "M"], ["Irene Flores", 1, "F"], ["Leo Domingo", 4, "M"],
  ["Mara Pascual", 3, "F"], ["Jun Soriano", 2, "M"], ["Elaine Uy", 5, "F"], ["Gabe Salazar", 3, "M"], ["Pia Rivera", 4, "F"], ["Noel Aguilar", 1, "M"],
  ["Sheila Ocampo", 3, "F"], ["Vince Manalo", 6, "M"], ["Dina Velasco", 2, "F"], ["Ken Padilla", 4, "M"], ["Rhea Lopez", 3, "F"], ["Arnel Chua", 3, "M"]];
SCENARIOS["sq5@demo.test"] = {
  title: "30 players, 4 empty courts, Skill Separated. Locked pairs: Maria+Jose (3 and 4 stars), Liza+Miguel, Cathy+Leo. Try every mode.",
  session: { mode: process.env.MODE || "Skill Separated", courts: 4 },
  gap: 20000, // arrived 20 s apart, so nobody counts as starved until about 15 minutes pass
  players: ROSTER.map(([n, k, g]) => [n, k, g, { "Maria Santos": { lock: "Jose Reyes" }, "Jose Reyes": { lock: "Maria Santos" }, "Liza Ramos": { lock: "Miguel Torres" },
    "Miguel Torres": { lock: "Liza Ramos" }, "Cathy Tan": { lock: "Leo Domingo" }, "Leo Domingo": { lock: "Cathy Tan" } }[n]]),
  courts: [],
};

const out = [];
for (const [email, sc] of Object.entries(SCENARIOS)) {
  const r = await (await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "password1", returnSecureToken: true }) })).json();
  const uid = r.localId || (await (await fetch(AUTH.replace("signUp", "signInWithPassword"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "password1", returnSecureToken: true }) })).json()).localId;
  await put(`accounts/${uid}`, { name: email.split("@")[0], email, createdAt: now });
  await put(`sessions/${uid}`, { location: "Queue Demo", format: "Doubles", autoRotate: true, createdAt: now, ...sc.session });
  for (const sub of ["players", "courts", "matchLog"]) {
    const list = await (await fetch(`${FS}/sessions/${uid}/${sub}?pageSize=300`, { headers: { Authorization: "Bearer owner" } })).json();
    for (const d of list.documents || []) await fetch(`http://127.0.0.1:8080/v1/${d.name}`, { method: "DELETE", headers: { Authorization: "Bearer owner" } });
  }
  const id = (n) => n.toLowerCase().replace(/\W+/g, "-");
  const court = { teamA: [], teamB: [] };
  let t = now - (sc.gap ? sc.gap * 31 : 3000000);
  for (const [name, skill, gender, x = {}] of sc.players) {
    t += sc.gap || 90000;
    await put(`sessions/${uid}/players/${id(name)}`, {
      id: id(name), name, skill, gender, games: 0, wins: 0, losses: 0, checked: true, createdAt: t, checkedAt: t,
      ...(x.lock ? { lockedWithId: id(x.lock) } : {}),
    });
    if (x.onCourt) court[x.onCourt === "A" ? "teamA" : "teamB"].push(id(name));
  }
  for (let i = 1; i <= sc.session.courts; i++) await put(`sessions/${uid}/courts/court-${i}`, { courtNumber: i, start: now, ...(i === 1 ? court : { teamA: [], teamB: [] }) });
  out.push(`${email}: ${sc.title}`);
}
console.log(out.join("\n"), '\npassword: password1');
