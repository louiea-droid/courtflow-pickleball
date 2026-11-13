import assert from "node:assert/strict";
import { AVATAR_IDS, AVATAR_MAX, avatarSrc } from "./avatar.js";

assert.equal(AVATAR_IDS.length, 12);
assert.equal(new Set(AVATAR_IDS).size, 12, "avatar ids are unique");
assert.ok(avatarSrc({ builtin: "a1" }).startsWith("data:image/svg+xml,"));
assert.equal(avatarSrc({ builtin: "nope" }), "");
assert.equal(avatarSrc(null), "");
assert.equal(avatarSrc({}), "");
const jpeg = "data:image/jpeg;base64,AAAA";
assert.equal(avatarSrc({ image: jpeg }), jpeg);
assert.equal(avatarSrc({ image: "data:image/png;base64,AAAA" }), "", "only JPEG");
assert.equal(avatarSrc({ image: `data:image/jpeg;base64,${"A".repeat(AVATAR_MAX)}` }), "", "too large");
assert.equal(avatarSrc({ image: 'data:image/jpeg;base64,A")' }), "", "nothing may close the quote");
console.log("avatar.check: ok");
