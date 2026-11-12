// Run: node src/utils/feed.check.mjs
import assert from "node:assert/strict";
import { feedStatus, NEW_MS, PIN_MS, POST_MAX, REPLY_MAX, cleanText, feedOrder, filterFeed, hasHeart, isAnnouncement, isNew, isPinned, roleTag } from "./feed.js";

const now = 1_800_000_000_000;
const DAY = 86400000;
assert.equal(PIN_MS, 7 * DAY);
assert.equal(NEW_MS, DAY);

assert.equal(isAnnouncement({}), true);
assert.equal(isAnnouncement({ announcement: false }), false);

assert.equal(isPinned({ announcement: true, createdAt: now - 6 * DAY }, now), true);
assert.equal(isPinned({ announcement: true, createdAt: now - 7 * DAY }, now), false);
assert.equal(isPinned({ announcement: false, createdAt: now - 60000 }, now), false);

const m1 = { id: "m1", announcement: false, createdAt: now - 60000 };
const a1 = { id: "a1", announcement: true, createdAt: now - 2 * DAY };
const m2 = { id: "m2", announcement: false, createdAt: now - 3 * DAY };
const a0 = { id: "a0", announcement: true, createdAt: now - 5 * DAY };
assert.deepEqual(feedOrder([m1, a1, m2], [a1, a0], now).map((p) => p.id), ["a1", "a0", "m1", "m2"]);
// a stale "pinned" entry (older than 7 days by now) is not pinned
assert.deepEqual(feedOrder([m1], [{ id: "x", createdAt: now - 8 * DAY }], now).map((p) => p.id), ["m1"]);

assert.deepEqual(filterFeed([m1, a1, { id: "old" }], "announcements").map((p) => p.id), ["a1", "old"]);
assert.equal(filterFeed([m1, a1], "all").length, 2);

assert.equal(hasHeart({ hearts: ["u"] }, "u"), true);
assert.equal(hasHeart({}, "u"), false);

assert.equal(isNew({ createdAt: now - 23 * 3600000 }, now), true);
assert.equal(isNew({ createdAt: now - 25 * 3600000 }, now), false);

assert.equal(roleTag({ authorRole: "owner" }), "Owner");
assert.equal(roleTag({ authorRole: "member" }), "Member");
assert.equal(roleTag({ authorRole: "manager" }), "Manager");
assert.equal(roleTag({}), "Manager");

assert.equal(cleanText("  hi ", POST_MAX), "hi");
assert.throws(() => cleanText("   ", POST_MAX), /Write something/);
assert.throws(() => cleanText("x".repeat(2001), POST_MAX), /2000/);
assert.throws(() => cleanText("x".repeat(1001), REPLY_MAX), /Replies can be up to 1000/);

// Loading the next page keeps the posts on screen (only a first load shows "Loading").
assert.equal(feedStatus({ ready: false, error: false, posts: [] }), "loading");
assert.equal(feedStatus({ ready: false, error: false, posts: [m1] }), "list");
assert.equal(feedStatus({ ready: true, error: false, posts: [] }), "empty");
assert.equal(feedStatus({ ready: true, error: true, posts: [] }), "error");
assert.equal(feedStatus({ ready: true, error: false, posts: [] }, [a1]), "list"); // only a pinned post

console.log("feed.check: ok");
