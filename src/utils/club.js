export const CLUB_STORAGE_KEY = "cf-club";

export function slugifyClub(name) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "club";
}

export function authEmail(slug) {
  return `${slug}@courtflow.local`;
}

export function loadStoredClub() {
  try {
    const raw = localStorage.getItem(CLUB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredClub(club) {
  try {
    if (club) localStorage.setItem(CLUB_STORAGE_KEY, JSON.stringify(club));
    else localStorage.removeItem(CLUB_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode, etc.) — club just won't persist across reloads.
  }
}
