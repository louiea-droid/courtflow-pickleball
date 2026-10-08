import { collection, doc, getDoc, getDocs, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { directoryDocs, newFriendCode } from "./friends.js";

// Publishes this account to the friend directory (see friends.js): a friend code (picked once, never one that is
// taken), the code lookup, the name listing when "find me by name" is on, and a note of what was published on
// the account itself, in one batch (so the listing and the note never disagree). The person's name on their
// friendships is refreshed first, one by one and best effort: a friendship that was just removed, or an old
// malformed one, must never keep the listing from being updated. Called by useAccount when needsDirectorySync
// says the account and the directory differ.
export async function syncDirectory(db, uid, account) {
  let code = account.friendCode;
  for (let tries = 0; !code && tries < 5; tries += 1) {
    const candidate = newFriendCode();
    if (!(await getDoc(doc(db, "friendCodes", candidate))).exists()) code = candidate;
  }
  if (!code) throw new Error("No free friend code");

  const docs = directoryDocs(uid, { ...account, friendCode: code });
  const renamed = account.directory && account.directory.name !== docs.codeDoc.name;
  if (renamed) {
    const mine = await getDocs(query(collection(db, "friendships"), where("users", "array-contains", uid)));
    await Promise.allSettled(mine.docs.map((f) => updateDoc(f.ref, { [`names.${uid}`]: docs.codeDoc.name })));
  }
  const batch = writeBatch(db);
  batch.set(doc(db, "friendCodes", code), docs.codeDoc);
  if (docs.profile) batch.set(doc(db, "profiles", uid), docs.profile);
  else batch.delete(doc(db, "profiles", uid));
  batch.update(doc(db, "accounts", uid), {
    friendCode: code,
    directory: { name: docs.codeDoc.name, discoverable: account.discoverable !== false, code },
  });
  await batch.commit();
}
