import assert from "node:assert/strict";
import { MAX_ITEMS, MAX_SEEN, buildNotifications, capItems, markSeen, unseenCount } from "./notifications.js";

const me = "me";
const friendships = [
  { id: "a_me", users: ["a", "me"], names: { a: "Ana", me: "Me" }, status: "pending", requestedBy: "a" }, // received
  { id: "b_me", users: ["b", "me"], names: { b: "Bo", me: "Me" }, status: "pending", requestedBy: "me" }, // sent: no line
  { id: "c_me", users: ["c", "me"], names: { c: "Cy", me: "Me" }, status: "accepted", requestedBy: "c" }, // friend: no line
];
const chats = [
  { id: "club_pub", kind: "club", title: "Pub Club", lastText: "see you at 8", lastBy: "cal", lastAt: 100 },
  { id: "dm_cal_me", kind: "dm", names: { cal: "Cal", me: "Me" }, lastText: "you free?", lastBy: "cal", lastAt: 200 },
  { id: "club_read", kind: "club", title: "Read Club", lastText: "old", lastBy: "cal", lastAt: 50 }, // read below
  { id: "club_mine", kind: "club", title: "Mine Club", lastText: "my own", lastBy: "me", lastAt: 300 }, // my own message
];
const reads = { club_read: { at: 60 } };
const joinRequests = [
  { id: "u1", clubId: "pub", clubName: "Pub Club", name: "Dee", createdAt: 10 },
  { id: "u2", clubId: "pub", clubName: "Pub Club", name: "Eli", createdAt: 20 },
];
const games = [
  { club: { id: "pub", clubName: "Pub Club" }, event: { id: "e1" }, status: { state: "waiting", position: 1, upNext: true, nextOn: 2 }, queuePath: "/clubs/pub/event/e1/queue" },
  { club: { id: "pub", clubName: "Pub Club" }, event: { id: "e2" }, status: { state: "playing", court: 3 }, queuePath: "/clubs/pub/event/e2/queue" },
  { club: { id: "pub", clubName: "Pub Club" }, event: { id: "e3" }, status: { state: "waiting", position: 4, upNext: false }, queuePath: "/clubs/pub/event/e3/queue" }, // waiting, not next
  { club: { id: "pub", clubName: "Pub Club" }, event: { id: "e4" }, host: true, queuePath: "/clubs/pub/event/e4/queue" }, // hosts only
];

const items = buildNotifications({ uid: me, friendships, chats, reads, joinRequests, activeGames: games });

// Order: turn alerts, friend requests, join requests (newest first), chats (newest first).
assert.deepEqual(items.map((i) => i.kind), ["turn", "turn", "friend", "join", "join", "chat", "chat"]);
assert.deepEqual(items.filter((i) => i.kind === "join").map((i) => i.title), ["Eli asked to join Pub Club", "Dee asked to join Pub Club"]);
assert.deepEqual(items.filter((i) => i.kind === "chat").map((i) => i.title), ["Cal sent you a message", "New message in Pub Club"]);
assert.equal(items.find((i) => i.key === "chat:club_pub:100").sub, "see you at 8");

// Turn alerts: only a game the person plays in and is up next or playing; a host-only game and a far-off waiter give none.
const turns = items.filter((i) => i.kind === "turn");
assert.deepEqual(turns.map((t) => t.title).sort(), ["You're on Court 3", "You're up next on Court 2"]);
assert.equal(turns.every((t) => t.sub === "Pub Club" && t.to.endsWith("/queue")), true);
assert.equal(buildNotifications({ uid: me, activeGames: [games[3]] }).length, 0);
assert.equal(buildNotifications({ uid: me, activeGames: [games[2]] }).length, 0);

// Friend: only a request someone else sent; links to /friends.
const friend = items.find((i) => i.kind === "friend");
assert.deepEqual([friend.key, friend.title, friend.to], ["friend:a_me", "Ana sent you a friend request", "/friends"]);

// Join: links to the club's members page (ids are URL-encoded).
assert.equal(items.find((i) => i.key === "join:pub:u2").to, "/clubs/pub/members");
assert.equal(buildNotifications({ uid: me, joinRequests: [{ id: "u", clubId: "a b", clubName: "X", name: "Y", createdAt: 1 }] })[0].to, "/clubs/a%20b/members");

// Chat: a chat I read, and one whose last line I wrote, are not notifications; links to the chat.
assert.equal(items.some((i) => i.key.startsWith("chat:club_read") || i.key.startsWith("chat:club_mine")), false);
assert.equal(items.find((i) => i.key === "chat:dm_cal_me:200").to, "/inbox/dm_cal_me");
// A direct message whose sender has no name on the chat still reads well.
assert.equal(buildNotifications({ uid: me, chats: [{ id: "dm_x_me", kind: "dm", names: {}, lastText: "hi", lastBy: "x", lastAt: 5 }] })[0].title, "Someone sent you a message");

// Cap: 25 items show 20 and "5 more", but all 25 count for the badge.
const many = Array.from({ length: 25 }, (_, i) => ({ id: `u${i}`, clubId: "pub", clubName: "Pub Club", name: `P${i}`, createdAt: i }));
const big = buildNotifications({ uid: me, joinRequests: many });
assert.equal(MAX_ITEMS, 20);
assert.deepEqual([capItems(big).shown.length, capItems(big).more], [20, 5]);
assert.deepEqual([capItems(items.slice(0, 3)).shown.length, capItems(items.slice(0, 3)).more], [3, 0]);
assert.equal(unseenCount(big, []), 25);

// Seen set: counts only keys not seen; opening marks all; a new chat line (new lastAt) is new again.
assert.equal(unseenCount(items, []), items.length);
const seen = markSeen([], items);
assert.equal(unseenCount(items, seen), 0);
assert.equal(markSeen(seen, items), seen); // nothing new: the same array back
const later = buildNotifications({ uid: me, chats: [{ ...chats[0], lastAt: 999 }], reads });
assert.equal(unseenCount(later, seen), 1);

// The seen set is capped to the newest MAX_SEEN keys.
assert.equal(MAX_SEEN, 200);
const flood = markSeen(Array.from({ length: 199 }, (_, i) => `old${i}`), [{ key: "n1" }, { key: "n2" }, { key: "n3" }]);
assert.equal(flood.length, 200);
assert.deepEqual(flood.slice(-3), ["n1", "n2", "n3"]);
assert.equal(flood.includes("old0"), false);

console.log("notifications.check: ok");
