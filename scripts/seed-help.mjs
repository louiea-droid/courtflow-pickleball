// Seeds the local emulators with demo data for the Help page screenshots (docs/help-screenshots.md).
// Needs `npm run emulators` running (Auth 9099, Firestore 8080, project demo-courtflow). Demo names only.
// Usage: node scripts/seed-help.mjs   -> prints the demo logins (password "password1") and the ids it made.
const AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=x";
const FS = "http://127.0.0.1:8080/v1/projects/demo-courtflow/databases/(default)/documents";
const val = (v) => Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
  : typeof v === "number" ? { integerValue: String(v) } : typeof v === "string" ? { stringValue: v }
  : typeof v === "boolean" ? { booleanValue: v }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
// The emulator accepts "Bearer owner" as an admin token, so these writes skip the rules.
const put = (path, data) => fetch(`${FS}/${path}`, { method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ fields: val(data).mapValue.fields }) })
  .then(async (r) => { if (!r.ok) throw new Error(`${path} ${await r.text()}`); });
const day = (n) => new Date(Date.now() + n * 86400000).toLocaleDateString("en-CA");
const now = Date.now();

const people = { ann: "Ann Reyes", bea: "Bea Santos", cal: "Cal Mercado", dee: "Dee Cruz", eli: "Eli Navarro" };
const uid = {};
for (const [k, name] of Object.entries(people)) {
  const r = await (await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `${k}@demo.test`, password: "password1", returnSecureToken: true }) })).json();
  if (!r.localId) throw new Error(JSON.stringify(r));
  uid[k] = r.localId;
  await put(`accounts/${r.localId}`, { name, email: `${k}@demo.test`, createdAt: now, friendCode: `DEMO${k.toUpperCase().padEnd(4, "X")}`.slice(0, 8) });
}

const display = { timeZone: "Asia/Manila", hour12: true, theme: "light", accent: "#2fa55b", team1: "#6c5ce0", team2: "#0e9488" };
const club = async (id, name, owner, ownerKey, location, description, members) => {
  await put(`clubs/${id}`, { name, nameLower: name.toLowerCase(), visibility: "public", ownerId: owner, createdAt: now, location, description, display });
  for (const [k, role] of Object.entries(members)) {
    await put(`clubs/${id}/members/${uid[k]}`, { role, name: people[k], joinedAt: now });
    await put(`accounts/${uid[k]}/memberships/${id}`, { clubName: name, role, joinedAt: now });
  }
};
await club("pub", "Pub Club", uid.ann, "ann", "Manila", "Friendly open play every week.", { ann: "owner", bea: "manager", cal: "member", dee: "member", eli: "member" });
await club("beta", "Beta Club", uid.bea, "bea", "Cebu", "Drills and socials by the sea.", { bea: "owner" });
await club("riverside", "Riverside Pickle", uid.cal, "cal", "Quezon City", "Evening games near the river.", { cal: "owner" });
await put("clubs/pub/private/invite", { code: "DEMOJOIN" });
await put("chats/club_pub", { kind: "club", clubId: "pub", title: "Pub Club", lastText: "See you all Friday!", lastAt: now, lastBy: uid.bea, createdAt: now });

const meta = (id, name, loc) => ({ clubPublic: true, clubId: id, clubName: name, clubLocation: loc });
const ev = (club, title, date, start, extra = {}) => ({
  title, date, startTime: start, durationMins: 120, maxPlayers: 8, fee: 100, level: "Any Level", notes: "Bring water and a paddle.", payInfo: "GCash 0900 000 0000",
  attendees: [], status: "scheduled", hostName: club.name, timeZone: "Asia/Manila", createdAt: now, ...meta(club.id, club.name, club.loc), ...extra,
});
const PUB = { id: "pub", name: "Pub Club", loc: "Manila" }, BETA = { id: "beta", name: "Beta Club", loc: "Cebu" }, RIV = { id: "riverside", name: "Riverside Pickle", loc: "Quezon City" };
const seats = (n) => Array.from({ length: n }, (_, i) => ({ id: `seat${i}`, name: ["Gus", "Hal", "Ivy", "Jun", "Kai", "Lia", "Mo", "Nia", "Oz", "Pia"][i % 10], paid: i % 3 === 0 ? "paid" : "unpaid", method: "cash", joinedAt: now + i }));
await put("clubs/pub/events/friday", ev(PUB, "Friday mixer", day(1), "19:00", { attendees: seats(10) }));
await put("clubs/pub/events/saturday", ev(PUB, "Saturday drills", day(2), "08:00", { level: "Beginner", attendees: seats(4) }));
await put("clubs/beta/events/b1", ev(BETA, "Beginner drills", day(0), "23:00", { level: "Beginner", attendees: seats(3) }));
await put("clubs/beta/events/b2", ev(BETA, "Sunday social", day(3), "10:00", { attendees: seats(5) }));
await put("clubs/riverside/events/r1", ev(RIV, "Riverside night games", day(1), "20:00", { attendees: seats(6) }));
await put("clubs/riverside/events/r2", ev(RIV, "Weekend round robin", day(4), "09:00", { maxPlayers: 12, attendees: seats(2) }));

// A live game at Pub Club (Eli is waiting: #3 in line)
const LIVE = "thursday";
await put(`clubs/pub/events/${LIVE}`, ev(PUB, "Thursday open play", day(0), "20:00", { durationMins: 180, status: "live", startedAt: now - 1800000, courts: 2, format: "Doubles", mode: "Balanced", autoRotate: true }));
const roster = [
  ["p1", "Gus Lim", 3, "M", 2, 1, "g"], ["p2", "Hal Ramos", 4, "M", 2, 1, "g"], ["p3", "Ivy Tan", 3, "F", 2, 1, "g"], ["p4", "Jun Co", 4, "M", 2, 0, "g"],
  ["p5", "Kai Uy", 2, "M", 1, 1, "g"], ["p6", "Lia Go", 3, "F", 1, 0, "g"], ["p7", "Mo Sy", 4, "M", 1, 0, "g"], ["p8", "Nia Ong", 5, "F", 1, 1, "g"],
  ["p9", "Pia Dy", 3, "F", 1, 0, "q"], ["p10", "Quin Lee", 4, "M", 1, 1, "q"], ["p11", "Eli Navarro", 3, "M", 2, 1, "q"], ["p12", "Rey Ang", 2, "M", 2, 0, "q"],
];
let t = now - 3600000;
for (const [id, name, skill, gender, games, wins, where] of roster) {
  t += 120000;
  await put(`clubs/pub/events/${LIVE}/players`.concat(`/${id}`), {
    id, name, skill, gender, games, wins, losses: games - wins, checked: true, createdAt: t, checkedAt: t,
    ...(id === "p11" ? { uid: uid.eli } : {}),
  });
}
await put(`clubs/pub/events/${LIVE}/courts/court-1`, { courtNumber: 1, start: now - 420000, teamA: ["p1", "p2"], teamB: ["p3", "p4"] });
await put(`clubs/pub/events/${LIVE}/courts/court-2`, { courtNumber: 2, start: now - 240000, teamA: ["p5", "p6"], teamB: ["p7", "p8"] });
// a Quick session for Ann at /club (it reuses the signed-in account)
await put(`sessions/${uid.ann}`, { location: "Centro Pickle Club", courts: 2, format: "Doubles", mode: "Balanced", autoRotate: true, createdAt: now });
let q = now - 3000000;
for (const [id, name, skill, gender, games, wins, where] of roster) {
  q += 90000;
  await put(`sessions/${uid.ann}/players/${id}`, { id, name: name.replace("Eli Navarro", "Eli N."), skill, gender, games, wins, losses: games - wins, checked: true, createdAt: q, checkedAt: q });
}
await put(`sessions/${uid.ann}/courts/court-1`, { courtNumber: 1, start: now - 420000, teamA: ["p1", "p2"], teamB: ["p3", "p4"] });
await put(`sessions/${uid.ann}/courts/court-2`, { courtNumber: 2, start: now - 240000, teamA: ["p5", "p6"], teamB: ["p7", "p8"] });

console.log(JSON.stringify({ logins: Object.keys(people).map((k) => `${k}@demo.test`), password: "password1", liveEvent: LIVE, uid }, null, 2));
