// Self-check for account helpers. Run: node src/utils/account.check.mjs
import assert from "node:assert";
import { authMessage, defaultClubName, hasPasswordProvider, isAccountUser, resetMessage } from "./account.js";

// Legacy club logins use fake @courtflow.local emails and are never accounts.
assert.equal(isAccountUser({ email: "host@gmail.com" }), true);
assert.equal(isAccountUser({ email: "centro-pickle@courtflow.local" }), false);
assert.equal(isAccountUser({ email: "CENTRO@COURTFLOW.LOCAL" }), false);
assert.equal(isAccountUser(null), false);
assert.equal(isAccountUser({ email: null }), false);

// Google-only accounts have no password to change or confirm.
assert.equal(hasPasswordProvider({ providerData: [{ providerId: "google.com" }] }), false);
assert.equal(hasPasswordProvider({ providerData: [{ providerId: "password" }, { providerId: "google.com" }] }), true);

assert.equal(defaultClubName({ displayName: "  Centro Pickle  ", email: "a@b.co" }), "Centro Pickle");
assert.equal(defaultClubName({ displayName: null, email: "louie.a@mail.com" }), "louie.a");

// Closing the Google window is not an error; a blocked window says what to do.
assert.equal(authMessage({ code: "auth/popup-closed-by-user" }), "");
assert.equal(authMessage({ code: "auth/cancelled-popup-request" }), "");
assert.match(authMessage({ code: "auth/popup-blocked" }), /pop-ups/);
// Wrong password and unknown email read the same, so sign-in can't be used to probe accounts.
assert.equal(authMessage({ code: "auth/wrong-password" }), authMessage({ code: "auth/user-not-found" }));
assert.equal(authMessage({ code: "auth/invalid-credential" }), authMessage({ code: "auth/user-not-found" }));
assert.match(authMessage({ code: "auth/email-already-in-use" }), /already exists/);
assert.match(authMessage({ code: "auth/weak-password" }), /6 characters/);
assert.match(authMessage({ code: "auth/network-request-failed" }), /connection/);
assert.match(authMessage({ code: "auth/too-many-requests" }), /Wait/);
assert.match(authMessage(new Error("boom")), /try again/);
assert.match(authMessage(undefined), /try again/);

// Reset never reveals whether an email has an account.
assert.equal(resetMessage({ code: "auth/user-not-found" }), "");
assert.match(resetMessage({ code: "auth/invalid-email" }), /email/);
assert.match(resetMessage({ code: "auth/network-request-failed" }), /connection/);

console.log("account.check: ok");
