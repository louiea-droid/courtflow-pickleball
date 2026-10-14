// A payment receipt is a photo the player attaches when they pay online. It is shrunk on the phone and saved as a
// JPEG data URL on their private booking request (managers read it; no separate storage service). The rules cap
// the field at 400000 characters, so the limit here stays a little under that.
export const RECEIPT_PREFIX = "data:image/jpeg;base64,";
export const RECEIPT_MAX = 380000;

// Each try: the longest side in pixels, then the JPEG quality. Smaller and lower each time until it fits.
export const COMPRESS_STEPS = [[1280, 0.72], [1024, 0.65], [800, 0.6], [640, 0.5]];

// Scale to fit `max` on the longer side, never enlarge, never collapse to zero.
export function fitSize(width, height, max) {
  const w = Math.max(1, width || 0), h = Math.max(1, height || 0);
  const k = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export const isReceipt = (value) =>
  typeof value === "string" && value.startsWith(RECEIPT_PREFIX) && value.length <= RECEIPT_MAX;

const load = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a picture we can read.")); };
  img.src = url;
});

// A photo from the phone's camera or gallery -> a JPEG data URL under RECEIPT_MAX. Rejects for a non-image or a
// picture that will not shrink enough (very rare: a huge, noisy photo even at the smallest step).
export async function compressImage(file) {
  if (!file || !String(file.type).startsWith("image/")) throw new Error("Choose a picture of your receipt.");
  const img = await load(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  for (const [max, quality] of COMPRESS_STEPS) {
    const { width, height } = fitSize(img.naturalWidth, img.naturalHeight, max);
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#fff"; // a transparent screenshot would turn black as a JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (isReceipt(url)) return url;
  }
  throw new Error("That picture is too large. Try a screenshot instead.");
}
