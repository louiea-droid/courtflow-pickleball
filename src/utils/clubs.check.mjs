// Self-check for club helpers. Run: node src/utils/clubs.check.mjs
import assert from "node:assert";
import { ROLE_LABEL, canChangeRole, canRemove, clubPath, filterClubs, inviteUrl, joinRequestDoc, memberRecord, membershipCopy, newClubDoc, newInviteCode, permissions, validateClubInput, validateJoinMessage } from "./clubs.js";

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
assert.equal(club.rules.avoidRepeatPartners, true);
assert.equal(club.ruleDefaultsVersion, 1);
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

// Part B: invite codes are 8 characters without look-alikes (no I, O, 0, 1) and differ every time.
const code = newInviteCode();
assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
assert.notEqual(code, newInviteCode());
assert.equal(inviteUrl("https://x.test", "abc", "K7M2QXWA"), "https://x.test/clubs/abc?invite=K7M2QXWA");
assert.equal(inviteUrl("https://x.test", "a b", "c/d"), "https://x.test/clubs/a%20b?invite=c%2Fd");

// Join messages are optional, up to 200 characters.
assert.equal(validateJoinMessage(""), "");
assert.equal(validateJoinMessage("x".repeat(200)), "");
assert.match(validateJoinMessage("x".repeat(201)), /200/);

// The request and member documents the rules accept: trimmed, names capped at 60, no empty message stored.
assert.deepEqual(joinRequestDoc("  Sam  ", "  hi  ", 7), { name: "Sam", message: "hi", status: "pending", createdAt: 7 });
assert.deepEqual(joinRequestDoc("Sam", "   ", 7), { name: "Sam", status: "pending", createdAt: 7 });
assert.equal(joinRequestDoc("x".repeat(80), "", 1).name.length, 60);
assert.equal(joinRequestDoc("  ", "", 1).name, "Member");
assert.deepEqual(memberRecord("Sam", 5), { role: "member", name: "Sam", joinedAt: 5 });
assert.deepEqual(memberRecord("Sam", 5, "K7M2QXWA"), { role: "member", name: "Sam", joinedAt: 5, inviteCode: "K7M2QXWA" });
assert.equal(memberRecord("", 5).name, "Member");
// Part C: the owner names managers; a manager link makes a manager record.
assert.deepEqual(memberRecord("Sam", 5, "K7M2QXWA", "manager"), { role: "manager", name: "Sam", joinedAt: 5, inviteCode: "K7M2QXWA" });
assert.equal(inviteUrl("https://x.test", "abc", "K7M2QXWA", "manager"), "https://x.test/clubs/abc?manager=K7M2QXWA");
assert.equal(canChangeRole("owner", "member"), true);
assert.equal(canChangeRole("owner", "manager"), true);
assert.equal(canChangeRole("owner", "owner"), false);
assert.equal(canChangeRole("manager", "member"), false);
assert.equal(canChangeRole("member", "member"), false);
assert.equal(canRemove("owner", "manager"), true);
assert.equal(canRemove("owner", "owner"), false);
assert.equal(canRemove("manager", "member"), true);
assert.equal(canRemove("manager", "manager"), false);
assert.equal(canRemove("manager", "owner"), false);
assert.equal(canRemove("member", "member"), false);

// Directory search: by name or place, case-insensitive, contains; the list is sorted by name.
const clubs = [
  { id: "1", name: "Centro Pickle", location: "Manila" },
  { id: "2", name: "Aces", location: "Cebu City" },
  { id: "3", name: "bay smash", location: "Davao" },
];
assert.deepEqual(filterClubs(clubs, "").map((c) => c.id), ["2", "3", "1"]);
assert.deepEqual(filterClubs(clubs, "PICK").map((c) => c.id), ["1"]);
assert.deepEqual(filterClubs(clubs, " cebu ").map((c) => c.id), ["2"]);
assert.deepEqual(filterClubs(clubs, "zzz"), []);
assert.deepEqual(filterClubs([{ id: "9" }], "a"), []); // a club without a name never matches or crashes

console.log("clubs.check: ok");
