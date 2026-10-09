import assert from "node:assert/strict";
import { MESSAGE_MAX, chatPreview, chatTail, chatTitle, clubChatId, clubIdOfChat, dmChatDoc, dmChatId, isHidden, isUnread, messageDoc, otherMember, sortChats, unreadCount, validateMessage, visibleChats } from "./chat.js";

assert.equal(MESSAGE_MAX, 1000);
assert.equal(clubChatId("abc"), "club_abc");
assert.equal(clubIdOfChat("club_abc"), "abc");
assert.equal(clubIdOfChat("dm_a_b"), null);
assert.equal(clubIdOfChat("club_"), null);

assert.equal(validateMessage("hi"), "");
assert.equal(validateMessage("   "), "Write a message first.");
assert.equal(validateMessage(""), "Write a message first.");
assert.equal(validateMessage("x".repeat(1000)), "");
assert.equal(validateMessage("x".repeat(1001)), "Messages can be up to 1000 characters.");
assert.equal(validateMessage("  " + "x".repeat(1000) + "  "), ""); // trimmed first

assert.deepEqual(messageDoc("u1", "  Sam ", "  hello  ", 5), { from: "u1", name: "Sam", text: "hello", createdAt: 5 });
assert.equal(messageDoc("u1", "", "x", 1).name, "Member");
assert.equal(messageDoc("u1", "n".repeat(80), "x", 1).name.length, 60);

assert.equal(chatPreview("a\nb\n\nc"), "a b c");
assert.equal(chatPreview("x".repeat(150)).length, 100);
assert.deepEqual(chatTail("u1", "hi there", 9, "m1"), { lastText: "hi there", lastAt: 9, lastBy: "u1", lastId: "m1" });

assert.equal(isUnread({ lastAt: 10, lastBy: "u2" }, 5, "u1"), true);
assert.equal(isUnread({ lastAt: 10, lastBy: "u2" }, 10, "u1"), false);   // read at the same moment
assert.equal(isUnread({ lastAt: 10, lastBy: "u1" }, 0, "u1"), false);    // your own message
assert.equal(isUnread({ lastAt: 0, lastBy: "" }, 0, "u1"), false);       // an empty chat
assert.equal(isUnread({ lastAt: 10, lastBy: "u2" }, undefined, "u1"), true);

const chats = [
  { id: "dm_a_b", kind: "dm", lastAt: 5 }, { id: "dm_a_c", kind: "dm", lastAt: 9 },
  { id: "club_z", kind: "club", title: "Zed Club", lastAt: 1 }, { id: "club_a", kind: "club", title: "Ace Club", lastAt: 0 },
];
assert.deepEqual(sortChats(chats).map((c) => c.id), ["club_a", "club_z", "dm_a_c", "dm_a_b"]);
assert.equal(unreadCount([{ id: "c1", lastAt: 9, lastBy: "u2" }, { id: "c2", lastAt: 9, lastBy: "u2" }, { id: "c3", lastAt: 9, lastBy: "u1" }], { c2: { at: 9 } }, "u1"), 1);

// Direct messages
assert.equal(dmChatId("b", "a"), "dm_a_b");
const d = dmChatDoc("b", "Bea", "a", "Al", 7, "club1");
assert.deepEqual(d, { kind: "dm", members: ["a", "b"], names: { b: "Bea", a: "Al" }, lastText: "", lastAt: 0, lastBy: "", createdAt: 7, viaClub: "club1" });
assert.equal("viaClub" in dmChatDoc("b", "Bea", "a", "Al", 7), false);
assert.deepEqual(otherMember(d, "b"), { id: "a", name: "Al" });
assert.deepEqual(otherMember(d, "a"), { id: "b", name: "Bea" });
assert.equal(chatTitle(d, "b"), "Al");
assert.equal(chatTitle({ kind: "club", title: "Ace Club" }, "b"), "Ace Club");
assert.equal(isHidden({ hidden: true, at: 10 }, { lastAt: 10 }), true);
assert.equal(isHidden({ hidden: true, at: 10 }, { lastAt: 11 }), false); // a newer message brings it back
assert.equal(isHidden({ at: 10 }, { lastAt: 1 }), false);
assert.equal(isHidden(undefined, { lastAt: 1 }), false);
assert.deepEqual(visibleChats([{ id: "x", lastAt: 5 }, { id: "y", lastAt: 5 }], { x: { hidden: true, at: 9 } }).map((c) => c.id), ["y"]);
console.log("chat.check: ok");
