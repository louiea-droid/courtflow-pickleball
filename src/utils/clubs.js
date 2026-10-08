// Pure rules for clubs: input checks, the documents a new club starts with, what each role may do,
// and club URLs. No Firestore here (that is useClubActions), so all of it is covered by clubs.check.mjs.
import { DEFAULT_COST, DEFAULT_DISPLAY, DEFAULT_LIVE, DEFAULT_RULES, seedSession } from "../data/constants.js";

export const VISIBILITIES = ["public", "private"];

// "" when fine, otherwise a message that says what to fix.
export function validateClubInput({ name = "", description = "", location = "", visibility = "public" }) {
  if (!name.trim()) return "Give your club a name.";
  if (name.trim().length > 60) return "Club names can be up to 60 characters.";
  if (description.trim().length > 500) return "The description can be up to 500 characters.";
  if (location.trim().length > 100) return "The location can be up to 100 characters.";
  if (!VISIBILITIES.includes(visibility)) return "Choose public or private.";
  return "";
}

// The club document a new club starts with. `nameLower` is for the directory search in part B.
export function newClubDoc({ name, description = "", location = "", visibility = "public" }, ownerId, now) {
  return {
    name: name.trim(),
    nameLower: name.trim().toLowerCase(),
    description: description.trim(),
    location: location.trim(),
    visibility,
    ownerId,
    createdAt: now,
    defaults: { courts: seedSession.courts, format: seedSession.format, mode: seedSession.mode },
    rules: { ...DEFAULT_RULES },
    costDefaults: { ...DEFAULT_COST },
    live: { ...DEFAULT_LIVE },
    display: { ...DEFAULT_DISPLAY },
  };
}

// The small copy under the person's account that powers "My clubs" without a database index.
export const membershipCopy = (club, role, now) => ({ clubName: club.name, role, joinedAt: now });

const RANK = { member: 1, manager: 2, owner: 3 };

// What a role may do in the screens (the rules enforce the same table on the server).
export function permissions(role) {
  const rank = RANK[role] || 0;
  return { isMember: rank >= 1, canManage: rank >= 2, isOwner: rank === 3 };
}

export const clubPath = (clubId, rest = "") => `/clubs/${encodeURIComponent(clubId)}${rest}`;

// Role names as shown on screen (hub cards, club header).
export const ROLE_LABEL = { owner: "Owner", manager: "Manager", member: "Member" };

// ---- Part B: joining ----
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 characters, so a byte maps evenly; no I, O, 0, 1

// A new invite code. Resetting the link stores a new one, which stops every old link.
export function newInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

export const inviteUrl = (origin, clubId, code) => `${origin}${clubPath(clubId)}?invite=${encodeURIComponent(code)}`;

export const JOIN_MESSAGE_MAX = 200;
export const validateJoinMessage = (message = "") =>
  (message.trim().length > JOIN_MESSAGE_MAX ? `The message can be up to ${JOIN_MESSAGE_MAX} characters.` : "");

const personName = (name) => (name || "").trim().slice(0, 60) || "Member";

// The documents the rules accept (see firestore.rules): a pending request, and a plain member record.
export function joinRequestDoc(name, message, now) {
  const text = (message || "").trim();
  return { name: personName(name), ...(text ? { message: text } : {}), status: "pending", createdAt: now };
}
export const memberRecord = (name, now, inviteCode) => ({
  role: "member", name: personName(name), joinedAt: now, ...(inviteCode ? { inviteCode } : {}),
});

// Directory search: runs on the device over the public clubs already loaded.
export function filterClubs(clubs, search = "") {
  const q = search.trim().toLowerCase();
  const sorted = [...clubs].sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase()));
  if (!q) return sorted;
  return sorted.filter((c) => `${c.name || ""} ${c.location || ""}`.toLowerCase().includes(q));
}
