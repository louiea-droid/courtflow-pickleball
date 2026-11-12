import assert from "node:assert/strict";
import { PHOTO_LIMITS, badgeStyle, isJpegUrl, squareCrop } from "./clubPhoto.js";
import { badgeColor } from "./clubs.js";

assert.deepEqual(squareCrop(400, 300), { sx: 50, sy: 0, size: 300 });
assert.deepEqual(squareCrop(300, 500), { sx: 0, sy: 100, size: 300 });

const P = "data:image/jpeg;base64,";
assert.equal(isJpegUrl(P + "A".repeat(10), 6000), true);
assert.equal(isJpegUrl(P + "A".repeat(6001 - P.length), 6000), false);
assert.equal(isJpegUrl(P + "A".repeat(6000 - P.length), 6000), true);
assert.equal(isJpegUrl("data:image/png;base64,xx", 6000), false);
assert.equal(isJpegUrl(42, 6000), false);
assert.equal(isJpegUrl(P + 'x"), url("https://evil.example/t', 6000), false); // no CSS injection
assert.equal(isJpegUrl(P + "ab+/9=", 6000), true);
assert.deepEqual(PHOTO_LIMITS, { thumb: 6000, photo: 40000, cover: 380000, post: 380000 });

// A badge shows the club's photo over its color, or just the color.
assert.deepEqual(badgeStyle("c1", P + "xx"), { background: badgeColor("c1"), backgroundImage: 'url("data:image/jpeg;base64,xx")' });
assert.deepEqual(badgeStyle("c1", ""), { background: badgeColor("c1") });
assert.deepEqual(badgeStyle("c1"), { background: badgeColor("c1") });
assert.deepEqual(badgeStyle("c1", P + 'x"), url("https://e.x/t'), { background: badgeColor("c1") }); // a bad value is ignored

console.log("clubPhoto ok");
