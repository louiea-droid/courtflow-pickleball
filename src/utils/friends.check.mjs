// Run: node src/utils/friends.check.mjs
import assert from "node:assert/strict";
import {
  directoryDocs, friendBuckets, friendshipDoc, isFriendCode, nameKey, nameRange, needsDirectorySync, newFriendCode, normalizeCode,
  pairId, relationTo,
} from "./friends.js";

assert.equal(newFriendCode().length, 8);
assert.ok(isFriendCode(newFriendCode()));
assert.equal(newFriendCode() === newFriendCode(), false);
assert.equal(normalizeCode(" k7m2-qxwa "), "K7M2QXWA");
assert.equal(isFriendCode("K7M2QXWA"), true);
assert.equal(isFriendCode("K7M2QXW"), false); // too short
assert.equal(isFriendCode("K7M2QXW0"), false); // 0 is not in the alphabet
assert.equal(isFriendCode(""), false);

assert.equal(nameKey("  Louie A "), "louie a");
assert.deepEqual(nameRange("Lou"), ["lou", "lou"]);
assert.equal(nameRange("L"), null); // one letter would list half the directory
assert.equal(nameRange("  "), null);

assert.equal(pairId("b", "a"), "a_b");
assert.equal(pairId("a", "b"), pairId("b", "a"));
const f = friendshipDoc("b", "Bea", "a", "Al", 5);
assert.deepEqual(f, { users: ["a", "b"], names: { b: "Bea", a: "Al" }, status: "pending", requestedBy: "b", createdAt: 5 });

const list = [
  { id: "a_b", users: ["a", "b"], status: "accepted", requestedBy: "a" },
  { id: "a_c", users: ["a", "c"], status: "pending", requestedBy: "a" },
  { id: "a_d", users: ["a", "d"], status: "pending", requestedBy: "d" },
];
assert.equal(relationTo(list, "a", "b"), "friends");
assert.equal(relationTo(list, "b", "a"), "friends");
assert.equal(relationTo(list, "a", "c"), "sent");
assert.equal(relationTo(list, "c", "a"), "received");
assert.equal(relationTo(list, "a", "d"), "received");
assert.equal(relationTo(list, "a", "zzz"), "none");
assert.equal(relationTo(list, "a", "a"), "none");

const acct = { name: "Lou", friendCode: "K7M2QXWA", directory: { name: "Lou", discoverable: true, code: "K7M2QXWA" } };
assert.equal(needsDirectorySync(acct), false);
assert.equal(needsDirectorySync({ ...acct, name: "Louie" }), true); // renamed
assert.equal(needsDirectorySync({ ...acct, discoverable: false }), true); // switch turned off
assert.equal(needsDirectorySync({ name: "Lou" }), true); // no code yet
assert.equal(needsDirectorySync({ ...acct, directory: undefined }), true);
assert.equal(needsDirectorySync({ ...acct, discoverable: true }), false); // explicit true = default
assert.equal(needsDirectorySync({ name: "  ", friendCode: "K7M2QXWA" }), false); // nothing to publish yet: wait for a name

assert.deepEqual(directoryDocs("u1", acct), { code: "K7M2QXWA", codeDoc: { uid: "u1", name: "Lou" }, profile: { name: "Lou", nameLower: "lou" } });
assert.equal(directoryDocs("u1", { ...acct, discoverable: false }).profile, null);
assert.equal(directoryDocs("u1", { ...acct, name: "x".repeat(80) }).codeDoc.name.length, 60);

// Buckets for the page: the other person's name, sorted; requests split by who sent them
const mine = [
  { id: "a_b", users: ["a", "b"], names: { a: "Al", b: "Bea" }, status: "accepted", requestedBy: "a" },
  { id: "a_c", users: ["a", "c"], names: { a: "Al", c: "Cy" }, status: "pending", requestedBy: "a" },
  { id: "a_d", users: ["a", "d"], names: { a: "Al", d: "Dee" }, status: "pending", requestedBy: "d" },
  { id: "a_e", users: ["a", "e"], names: { a: "Al", e: "abe" }, status: "accepted", requestedBy: "e" },
];
const buckets = friendBuckets(mine, "a");
assert.deepEqual(buckets.friends.map((x) => [x.otherId, x.name]), [["e", "abe"], ["b", "Bea"]]); // case-insensitive order
assert.deepEqual(buckets.sent.map((x) => x.otherId), ["c"]);
assert.deepEqual(buckets.received.map((x) => x.otherId), ["d"]);
assert.equal(buckets.friends[0].id, "a_e");
assert.deepEqual(friendBuckets([], "a"), { friends: [], received: [], sent: [] });
assert.equal(friendBuckets([{ id: "a_z", users: ["a", "z"], status: "accepted" }], "a").friends[0].name, "Someone"); // a missing name never breaks the page
console.log("friends.check: ok");
