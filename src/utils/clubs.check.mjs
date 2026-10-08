// Self-check for club helpers. Run: node src/utils/clubs.check.mjs
import assert from "node:assert";
import { ROLE_LABEL, clubPath, membershipCopy, newClubDoc, permissions, validateClubInput } from "./clubs.js";

// Input checks: each failure says what to fix.
assert.equal(validateClubInput({ name: "Centro", visibility: "public" }), "");
assert.match(validateClubInput({ name: "  ", visibility: "public" }), /name/i);
assert.match(validateClubInput({ name: "x".repeat(61), visibility: "public" }), /60/);
assert.match(validateClubInput({ name: "A", description: "x".repeat(501), visibility: "public" }), /500/);
assert.match(validateClubInput({ name: "A", location: "x".repeat(101), visibility: "public" }), /100/);
assert.match(validateClubInput({ name: "A", visibility: "secret" }), /public or private/i);
assert.equal(validateClubInput({ name: "A" }), ""); // visibility defaults to public

// A new club: trimmed text, a lowercase copy of the name for search, the owner, and working settings.
const club = newClubDoc({ name: "  Centro Pickle  ", description: " Fun ", location: " Manila ", visibility: "private" }, "u1", 99);
assert.equal(club.name, "Centro Pickle");
assert.equal(club.nameLower, "centro pickle");
assert.equal(club.description, "Fun");
assert.equal(club.location, "Manila");
assert.equal(club.visibility, "private");
assert.equal(club.ownerId, "u1");
assert.equal(club.createdAt, 99);
assert.deepEqual(club.defaults, { courts: 2, format: "Doubles", mode: "Balanced" });
assert.equal(club.rules.maxWinStreak, 2);
assert.equal(club.display.timeZone, "Asia/Manila");
assert.equal(newClubDoc({ name: "A" }, "u1", 1).visibility, "public");
// Settings are copies, so editing one club never changes another.
assert.notStrictEqual(newClubDoc({ name: "A" }, "u1", 1).rules, newClubDoc({ name: "B" }, "u1", 1).rules);

assert.deepEqual(membershipCopy(club, "owner", 5), { clubName: "Centro Pickle", role: "owner", joinedAt: 5 });

// Review Focus 3: what each role may do (a missing or unknown role may do nothing).
assert.deepEqual(permissions("owner"), { isMember: true, canManage: true, isOwner: true });
assert.deepEqual(permissions("manager"), { isMember: true, canManage: true, isOwner: false });
assert.deepEqual(permissions("member"), { isMember: true, canManage: false, isOwner: false });
assert.deepEqual(permissions(null), { isMember: false, canManage: false, isOwner: false });
assert.deepEqual(permissions("hacker"), { isMember: false, canManage: false, isOwner: false });

assert.equal(clubPath("abc"), "/clubs/abc");
assert.equal(clubPath("abc", "/host"), "/clubs/abc/host");
assert.equal(clubPath("a b", "/settings"), "/clubs/a%20b/settings");

// One set of role names for every screen.
assert.deepEqual(ROLE_LABEL, { owner: "Owner", manager: "Manager", member: "Member" });

console.log("clubs.check: ok");
