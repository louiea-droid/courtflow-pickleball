// Club photos are JPEG data URLs shrunk on the device (no Firebase Storage). Three sizes, each stored where only its
// readers load it: a 64 px thumbnail on the club doc (`photo`, copied onto events as `clubPhoto`), a 256 px photo at
// clubs/{id}/media/photo and a cover at clubs/{id}/media/cover. firestore.rules enforces the same limits.
import { badgeColor } from "./clubs.js";
import { COMPRESS_STEPS, RECEIPT_PREFIX } from "./receipt.js";

export const PHOTO_LIMITS = { thumb: 6000, photo: 40000, cover: 380000, post: 380000 };

// [longest side or square size, JPEG quality], tried in order until the result fits.
export const PHOTO_STEPS = {
  thumb: [[64, 0.8], [64, 0.6]],
  photo: [[256, 0.8], [256, 0.65], [256, 0.5]],
  cover: [[1600, 0.72], ...COMPRESS_STEPS],
  post: COMPRESS_STEPS, // a feed post photo: 1280 px first, like receipts
};

// Base64 only after the prefix (same as the rules): photos go into CSS url("..."), so nothing may close the quote.
const JPEG_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
export const isJpegUrl = (value, max) => typeof value === "string" && value.length <= max && JPEG_URL.test(value);

// A CSS background-image for a stored photo, or undefined for a missing or malformed one.
export const photoUrl = (value) => (isJpegUrl(value, PHOTO_LIMITS.cover) ? `url("${value}")` : undefined);

// The centered square of a w x h picture.
export function squareCrop(w, h) {
  const size = Math.min(w, h);
  return { sx: Math.round((w - size) / 2), sy: Math.round((h - size) / 2), size };
}

// A club badge's inline style: the club's color, with its photo on top when it has one.
export const badgeStyle = (id, photo) =>
  photoUrl(photo) ? { background: badgeColor(id), backgroundImage: photoUrl(photo) } : { background: badgeColor(id) };
