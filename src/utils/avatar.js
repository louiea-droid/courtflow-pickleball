// Profile pictures: `avatars/{uid}` = { image } (a 128 px square JPEG data URL made on the device) or { builtin } (an id
// from data/avatars.js), plus `updatedAt`. Pure helpers; firestore.rules enforces the same limits.
import { AVATARS } from "../data/avatars.js";
import { isJpegUrl } from "./clubPhoto.js";

export const AVATAR_MAX = 12000;
export const AVATAR_STEPS = [[128, 0.8], [128, 0.65], [96, 0.6]];
export const AVATAR_IDS = AVATARS.map(([id]) => id);

const svgs = new Map(AVATARS.map(([id, , body]) => [id, `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)}`]));

// The picture to draw for an avatar doc (an <img> src), or "" for none / malformed.
export function avatarSrc(doc) {
  if (!doc) return "";
  if (doc.builtin) return svgs.get(doc.builtin) || "";
  return isJpegUrl(doc.image, AVATAR_MAX) ? doc.image : "";
}
