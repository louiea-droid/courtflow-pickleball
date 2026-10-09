import assert from "node:assert/strict";
import { MESSAGE_MAX, chatPreview, chatTail, clubChatId, clubIdOfChat, isUnread, messageDoc, sortChats, unreadCount, validateMessage } from "./chat.js";

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
assert.deepEqual(chatTail("u1", "hi there", 9), { lastText: "hi there", lastAt: 9, lastBy: "u1" });

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
console.log("chat.check: ok");
