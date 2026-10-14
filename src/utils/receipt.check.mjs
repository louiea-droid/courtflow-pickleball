// Self-check for the payment receipt helpers. Run: node src/utils/receipt.check.mjs
import assert from "node:assert/strict";
import { COMPRESS_STEPS, RECEIPT_MAX, RECEIPT_PREFIX, fitSize, isReceipt } from "./receipt.js";

// Pictures are scaled so the longer side fits, never enlarged, and keep their shape.
assert.deepEqual(fitSize(4000, 2000, 1280), { width: 1280, height: 640 });
assert.deepEqual(fitSize(1000, 3000, 1280), { width: 427, height: 1280 });
assert.deepEqual(fitSize(800, 600, 1280), { width: 800, height: 600 }); // already small: unchanged
assert.deepEqual(fitSize(1280, 1280, 1280), { width: 1280, height: 1280 });
assert.deepEqual(fitSize(1, 5000, 1280), { width: 1, height: 1280 }); // never collapses to zero width
assert.deepEqual(fitSize(0, 0, 1280), { width: 1, height: 1 }); // a broken image still gives a drawable size

// The ladder gets smaller and lower quality at each step, ending well under the cap.
assert.ok(COMPRESS_STEPS.length >= 3);
for (let i = 1; i < COMPRESS_STEPS.length; i++) {
  assert.ok(COMPRESS_STEPS[i][0] < COMPRESS_STEPS[i - 1][0], "each step is smaller");
  assert.ok(COMPRESS_STEPS[i][1] <= COMPRESS_STEPS[i - 1][1], "and never higher quality");
}

// What the rules accept: a JPEG data URL under the cap. Anything else is not a receipt.
assert.equal(RECEIPT_PREFIX, "data:image/jpeg;base64,");
assert.equal(isReceipt(`${RECEIPT_PREFIX}AAAA`), true);
assert.equal(isReceipt(`${RECEIPT_PREFIX}${"A".repeat(RECEIPT_MAX - RECEIPT_PREFIX.length)}`), true); // exactly at the cap
assert.equal(isReceipt(`${RECEIPT_PREFIX}${"A".repeat(RECEIPT_MAX)}`), false); // over the cap
assert.equal(isReceipt("data:image/png;base64,AAAA"), false);
assert.equal(isReceipt("https://example.com/receipt.jpg"), false);
assert.equal(isReceipt(""), false);
assert.equal(isReceipt(null), false);
assert.equal(isReceipt(42), false);
assert.ok(RECEIPT_MAX < 400000, "stays under the cap the rules enforce");

console.log("receipt.check: ok");
