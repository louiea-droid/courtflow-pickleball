// Firestore rules for club photos: the thumbnail on the club doc, media/{photo,cover} and the clubPhoto copy on events.
// Run: npm run test:rules (needs Java and the Firebase CLI).
import fs from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "club-photo-test",
  firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
});

const real = (uid) => env.authenticatedContext(uid, { email: `${uid}@example.com`, firebase: { sign_in_provider: "password" } }).firestore();
const anonymous = env.unauthenticatedContext().firestore();
const manager = real("manager");
const member = real("member");
const stranger = real("stranger");
const P = "data:image/jpeg;base64,";
const jpeg = (n) => P + "A".repeat(n - P.length);
const club = (db, id = "public") => doc(db, `clubs/${id}`);
const media = (db, name, id = "public") => doc(db, `clubs/${id}/media/${name}`);
const shot = (n) => ({ image: jpeg(n), updatedAt: Date.now() });
const event = (extra = {}) => ({ title: "Thursday", date: "2026-12-01", startTime: "18:00", clubId: "public", clubName: "Public club", ...extra });

await env.clearFirestore();
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "clubs/public"), { name: "Public club", visibility: "public", ownerId: "owner" });
  await setDoc(doc(db, "clubs/private"), { name: "Private club", visibility: "private", ownerId: "owner" });
  for (const clubId of ["public", "private"]) {
    await setDoc(doc(db, `clubs/${clubId}/members/owner`), { role: "owner", name: "Club Owner" });
    await setDoc(doc(db, `clubs/${clubId}/members/manager`), { role: "manager", name: "Club Manager" });
    await setDoc(doc(db, `clubs/${clubId}/members/member`), { role: "member", name: "Club Member" });
  }
  await setDoc(doc(db, "clubs/private/media/cover"), shot(1000));
});

// The event copy with no club photo yet.
await assertSucceeds(setDoc(doc(manager, "clubs/public/events/e0"), event({ clubPhoto: "" })));
await assertFails(setDoc(doc(manager, "clubs/public/events/e1"), event({ clubPhoto: jpeg(100) })));

// The thumbnail on the club doc.
await assertSucceeds(updateDoc(club(manager), { photo: jpeg(100) }));
await assertFails(updateDoc(club(member), { photo: jpeg(100) }));
await assertFails(updateDoc(club(manager), { photo: jpeg(6001) }));
await assertFails(updateDoc(club(manager), { photo: "data:image/png;base64,xx" }));
// Only base64 after the prefix, so a photo can't smuggle a second CSS url() into a badge's style.
await assertFails(updateDoc(club(manager), { photo: P + 'x"), url("https://evil.example/t' }));
await assertFails(setDoc(media(manager, "cover"), { image: P + 'x") , url("https://e.x/t', updatedAt: Date.now() }));
await assertSucceeds(updateDoc(club(manager), { photo: jpeg(6000) }));

// The copy must equal the club's photo.
await assertSucceeds(setDoc(doc(manager, "clubs/public/events/e2"), event({ clubPhoto: jpeg(6000) })));
await assertFails(setDoc(doc(manager, "clubs/public/events/e3"), event({ clubPhoto: jpeg(100) })));
await assertFails(updateDoc(doc(manager, "clubs/public/events/e0"), { clubPhoto: jpeg(100) }));
await assertSucceeds(updateDoc(doc(manager, "clubs/public/events/e0"), { clubPhoto: jpeg(6000) }));

// media/cover and media/photo.
await assertSucceeds(setDoc(media(manager, "cover"), shot(300000)));
await assertFails(setDoc(media(manager, "cover"), shot(380001)));
await assertSucceeds(setDoc(media(manager, "photo"), shot(40000)));
await assertFails(setDoc(media(manager, "photo"), shot(40001)));
await assertFails(setDoc(media(manager, "other"), shot(100)));
await assertFails(setDoc(media(manager, "photo"), { ...shot(100), extra: 1 }));
await assertFails(setDoc(media(manager, "photo"), { image: "data:image/png;base64,xx", updatedAt: Date.now() }));
await assertFails(setDoc(media(member, "cover"), shot(100)));
await assertFails(setDoc(media(stranger, "cover"), shot(100)));

// Reads follow a get on the club.
await assertSucceeds(getDoc(media(anonymous, "cover")));
await assertFails(getDoc(media(anonymous, "cover", "private")));
await assertSucceeds(getDoc(media(stranger, "cover", "private")));

// Removal.
await assertFails(deleteDoc(media(member, "cover")));
await assertSucceeds(deleteDoc(media(manager, "cover")));

await env.cleanup();
console.log("clubPhoto.test: ok");
