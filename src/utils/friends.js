// Pure rules for friends: codes, the name search range, friendship documents and what the Friends page shows.
// No Firestore here (that is friendsData.js and the hooks), so all of it is covered by friends.check.mjs.
import { CODE_CHARS, newInviteCode } from "./clubs.js";

// A person's friend code: same alphabet and length as an invite code (no I, O, 0, 1).
export const newFriendCode = newInviteCode;
export const normalizeCode = (text = "") => text.toUpperCase().replace(/[\s-]/g, "");
export const isFriendCode = (text = "") => text.length === 8 && [...text].every((c) => CODE_CHARS.includes(c));

const clean = (name) => (name || "").trim().slice(0, 60);

// What profiles.nameLower holds, and the range a "starts with" search asks for. Under 2 characters is
// refused so one letter can't list a big part of the directory.
export const nameKey = (name) => (name || "").trim().toLowerCase();
export function nameRange(text) {
  const start = nameKey(text);
  return start.length < 2 ? null : [start, `${start}`];
}

// friendships/{pairId}: the two uids sorted and joined, so a pair has exactly one document.
export const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

export function friendshipDoc(me, meName, other, otherName, now) {
  return {
    users: [me, other].sort(),
    names: { [me]: clean(meName) || "Member", [other]: clean(otherName) || "Member" },
    status: "pending",
    requestedBy: me,
    createdAt: now,
  };
}

// How `other` stands with `me`: "friends", "sent" (I asked), "received" (they asked) or "none".
export function relationTo(friendships, me, other) {
  if (me === other) return "none";
  const f = friendships.find((x) => x.users.includes(me) && x.users.includes(other));
  if (!f) return "none";
  if (f.status === "accepted") return "friends";
  return f.requestedBy === me ? "sent" : "received";
}

// The directory keeps `accounts/{uid}.directory` as what was last published; it needs publishing again when
// there is no code yet or the name or the "find me by name" switch differs (default: findable).
export function needsDirectorySync(account = {}) {
  if (!clean(account.name)) return false; // nothing to publish yet
  const d = account.directory;
  return !account.friendCode || !d || d.name !== clean(account.name)
    || d.discoverable !== (account.discoverable !== false) || d.code !== account.friendCode;
}

// The documents the directory should hold for this account right now.
export function directoryDocs(uid, account) {
  const name = clean(account.name);
  return {
    code: account.friendCode,
    codeDoc: { uid, name },
    profile: account.discoverable === false ? null : { name, nameLower: nameKey(name) },
  };
}

// The Friends page: friends, requests that came to me, requests I sent; each with the other person's id and
// name (from the friendship's own copy of the names), sorted by name.
export function friendBuckets(friendships, me) {
  const rows = friendships.map((f) => {
    const otherId = f.users.find((u) => u !== me);
    return { ...f, otherId, name: f.names?.[otherId] || "Someone" };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return {
    friends: rows.filter((r) => r.status === "accepted"),
    received: rows.filter((r) => r.status === "pending" && r.requestedBy !== me),
    sent: rows.filter((r) => r.status === "pending" && r.requestedBy === me),
  };
}
