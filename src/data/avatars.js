// The 12 built-in profile pictures (owner-approved mockup, 2026-11-13): sport-neutral shapes in the brand colors.
// [id, label, SVG body on a 64 x 64 canvas]. The id is what an avatar doc stores (`builtin`), so never reuse one.
const dots = [14, 26, 38, 50].map((x) => [14, 26, 38, 50].map((y) => `<circle cx="${x}" cy="${y}" r="${(x + y) % 24 === 4 ? 4 : 2.6}"/>`).join("")).join("");

export const AVATARS = [
  ["a1", "Wave", `<rect width="64" height="64" fill="#0f2a22"/><path d="M0 40c12-8 22 6 34-2s20-8 30-2v28H0z" fill="#c6ef1f"/><path d="M0 47c12-7 22 5 34-1s20-6 30-1v19H0z" fill="#1f7a4a"/>`],
  ["a2", "Sunrise", `<rect width="64" height="64" fill="#1f7a4a"/><circle cx="32" cy="40" r="15" fill="#c6ef1f"/><path d="M0 44h64v20H0z" fill="#0f2a22"/><path d="M32 14v6M16 22l4 4M48 22l-4 4" stroke="#c6ef1f" stroke-width="3" stroke-linecap="round"/>`],
  ["a3", "Rings", `<rect width="64" height="64" fill="#14998a"/><circle cx="32" cy="32" r="22" fill="none" stroke="#fbfcf7" stroke-width="4" opacity=".35"/><circle cx="32" cy="32" r="14" fill="none" stroke="#fbfcf7" stroke-width="4" opacity=".7"/><circle cx="32" cy="32" r="6" fill="#fbfcf7"/>`],
  ["a4", "Stripes", `<rect width="64" height="64" fill="#6d5bd0"/><path d="M-8 40L40-8M4 52L52 4M16 64L64 16M28 76L76 28" stroke="#c6ef1f" stroke-width="6"/>`],
  ["a5", "Dots", `<rect width="64" height="64" fill="#e8664a"/><g fill="#fbfcf7">${dots}</g>`],
  ["a6", "Peaks", `<rect width="64" height="64" fill="#2f6fd6"/><circle cx="46" cy="18" r="6" fill="#fbfcf7"/><path d="M0 64L22 28l14 20 8-10 20 26z" fill="#0f2a22"/><path d="M22 28l6 10-6-3-5 4z" fill="#fbfcf7"/>`],
  ["a7", "Spark", `<rect width="64" height="64" fill="#f08a24"/><path d="M32 10c2 14 8 20 22 22-14 2-20 8-22 22-2-14-8-20-22-22 14-2 20-8 22-22z" fill="#0f2a22"/>`],
  ["a8", "Night", `<rect width="64" height="64" fill="#0f2a22"/><circle cx="34" cy="30" r="15" fill="#c6ef1f"/><circle cx="41" cy="25" r="13" fill="#0f2a22"/><g fill="#fbfcf7"><circle cx="16" cy="16" r="1.6"/><circle cx="50" cy="46" r="1.6"/><circle cx="20" cy="48" r="1.2"/></g>`],
  ["a9", "Leaf", `<rect width="64" height="64" fill="#1f7a4a"/><path d="M16 48C16 24 32 14 50 14c0 22-12 34-34 34z" fill="#c6ef1f"/><path d="M18 46L44 20" stroke="#1f7a4a" stroke-width="2.5"/>`],
  ["a10", "Bolt", `<rect width="64" height="64" fill="#d94f8a"/><path d="M36 8L18 36h12l-4 20 20-30H34z" fill="#fbfcf7"/>`],
  ["a11", "Tiles", `<rect width="64" height="64" fill="#c6ef1f"/><path d="M0 0h32v32H0zM32 32h32v32H32z" fill="#0f2a22"/><circle cx="32" cy="32" r="12" fill="#1f7a4a"/>`],
  ["a12", "Sea", `<rect width="64" height="64" fill="#fbfcf7"/><path d="M0 26c10-6 20 4 32-2s22-6 32 0v40H0z" fill="#2f6fd6"/><path d="M0 38c10-6 20 4 32-2s22-6 32 0v28H0z" fill="#1f7a4a"/><path d="M0 50c10-5 20 3 32-1s22-5 32 0v15H0z" fill="#0f2a22"/>`],
];
