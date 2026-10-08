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
