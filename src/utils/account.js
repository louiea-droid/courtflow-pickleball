// Helpers for real accounts (email/Google). Legacy club logins use fake
// emails on this domain and must never be mistaken for an account.
export const LEGACY_DOMAIN = "@courtflow.local";

export const isAccountUser = (user) =>
  Boolean(user?.email) && !user.email.toLowerCase().endsWith(LEGACY_DOMAIN);

// Google-only accounts have no password, so no password change or password confirm.
export const hasPasswordProvider = (user) =>
  user.providerData.some((p) => p.providerId === "password");

export const defaultClubName = (user) => user.displayName?.trim() || user.email.split("@")[0];

const MESSAGES = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-password": "Enter your password.",
  // Same text for all three so sign-in can't be used to find out which emails have accounts.
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a bit before trying again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/operation-not-allowed": "This sign-in method isn't turned on yet. Contact the admin.",
  "auth/requires-recent-login": "For safety, sign in again and then retry.",
};
// The person closed the Google window on purpose: nothing to report.
const QUIET = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export function authMessage(err) {
  const code = err?.code;
  if (QUIET.has(code)) return "";
  return MESSAGES[code] || "Something went wrong. Please try again.";
}

// Reset says the same thing whether or not the email has an account.
export const resetMessage = (err) => (err?.code === "auth/user-not-found" ? "" : authMessage(err));
