import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, collection, getDocs, writeBatch, getDoc,
} from "firebase/firestore";
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter(Boolean).map((l) => l.split("="))
);

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

const TARGET_IDS = [
  "edit-session-check-1789754191307",
  "session-choice-1789753979358",
  "session-choice-1789753913557",
  "winrow-check-1789753364907",
  "mobile-audit-1789753198026",
  "hscroll-check-1789753095957",
  "guide-skill-mobile-1789753046128",
  "mobile-audit2-1789752995944",
  "mobile-audit-1789752964960",
  "lb-matchlog-1789752708662",
  "dash-matchlog-1789752692167",
  "lb-matchlog-1789752565527",
  "dash-matchlog-1789752542013",
  "dash-matchlog-1789752354038",
  "guide-check-1789752133217",
  "guide-check2-1789752120081",
  "guide-check-1789752094155",
  "clock-width-1789751785015",
  "no-avatar-check-1789751497386",
  "smooth-check-1789750505919",
  "matchlog-check-1789750469873",
  "step-stress-1789750049749",
  "matchlog-check-1789750012982",
  "stack-check-1789749631971",
  "ticker-stress-1789749374187",
  "stack-check-1789749343345",
  "stack-check-1789749291346",
  "ticker-stress-1789748913133",
  "tv-check-1789748873873",
  "tv-check-1789748697235",
  "select-all-check-1789748154328",
  "select-all-check-1789748104649",
  "sticky-check-1789744075041",
  "final-check-1789744039961",
  "final-check-1789744008720",
  "cost-test-1789743528270",
  "history-test-1789743231107",
  "history-test-1789743195055",
  "checkin-demo-1789743008744",
  "design-pass-1789742975663",
  "design-pass-1789742930817",
  "live-board-demo-1789741776915",
  "live-board-demo-c-1789741753323",
  "live-board-demo-c-1789741708305",
  "live-board-demo-b-1789741662956",
  "live-board-demo-1789741581873",
  "design-check-club-1789741200065",
  "smoke-test-club-1789740384720",
];

const SUBCOLLECTIONS = ["players", "courts", "history", "costs", "matchLog"];

let batch = writeBatch(db);
let opsInBatch = 0;
const batches = [batch];

async function queueDelete(ref) {
  if (opsInBatch >= 450) {
    batch = writeBatch(db);
    batches.push(batch);
    opsInBatch = 0;
  }
  batch.delete(ref);
  opsInBatch++;
}

let sessionsFound = 0;
let sessionsMissing = 0;
let subdocsQueued = 0;

for (const id of TARGET_IDS) {
  const sessionRef = doc(db, "sessions", id);
  const snap = await getDoc(sessionRef);
  if (!snap.exists()) { sessionsMissing++; console.log("skip (not found):", id); continue; }
  sessionsFound++;
  for (const sub of SUBCOLLECTIONS) {
    const subSnap = await getDocs(collection(db, "sessions", id, sub));
    for (const d of subSnap.docs) {
      await queueDelete(d.ref);
      subdocsQueued++;
    }
  }
  await queueDelete(sessionRef);
}

console.log(`Sessions found: ${sessionsFound}, missing: ${sessionsMissing}, subdocs queued: ${subdocsQueued}, total batches: ${batches.length}`);

for (let i = 0; i < batches.length; i++) {
  await batches[i].commit();
  console.log(`Committed batch ${i + 1}/${batches.length}`);
}

console.log("Done.");
process.exit(0);
