// The notifications bell's list, worked out from data the app already holds (friend requests, the inbox, active
// games) plus the join requests of the clubs the person runs. Pure: no Firestore here, the hooks read the data.
import { friendBuckets } from "./friends.js";
import { isUnread } from "./chat.js";

export const MAX_ITEMS = 20;
export const MAX_SEEN = 200;
const GROUP = { turn: 0, friend: 1, join: 2, chat: 3 };

// Item = { key, kind, title, sub, to, at }. `key` names what makes it new (a new chat line has a new key).
export function buildNotifications({ uid, friendships = [], chats = [], reads = {}, joinRequests = [], activeGames = [] }) {
  const items = [];

  activeGames.forEach((g) => {
    const s = g.status; // a game the person only hosts has no status, so no turn
    if (!s) return;
    const playing = s.state === "playing";
    if (!playing && !s.upNext) return;
    items.push({
      key: `turn:${g.club.id}/${g.event.id}:${playing ? "playing" : "next"}`, kind: "turn",
      title: playing ? `You're on Court ${s.court}` : `You're up next${s.nextOn ? ` on Court ${s.nextOn}` : ""}`,
      sub: g.club.clubName, to: g.queuePath, at: 0,
    });
  });

  friendBuckets(friendships, uid).received.forEach((f) => {
    items.push({ key: `friend:${f.id || f.users.join("_")}`, kind: "friend", title: `${f.name} sent you a friend request`, sub: "", to: "/friends", at: 0 });
  });

  joinRequests.forEach((r) => {
    items.push({
      key: `join:${r.clubId}:${r.id}`, kind: "join", title: `${r.name} asked to join ${r.clubName}`, sub: "",
      to: `/clubs/${encodeURIComponent(r.clubId)}/members`, at: r.createdAt || 0,
    });
  });

  chats.filter((c) => isUnread(c, reads[c.id]?.at, uid)).forEach((c) => {
    items.push({
      key: `chat:${c.id}:${c.lastAt}`, kind: "chat",
      title: c.kind === "dm" ? `${c.names?.[c.lastBy] || "Someone"} sent you a message` : `New message in ${c.title || "your club"}`,
      sub: c.lastText || "", to: `/inbox/${encodeURIComponent(c.id)}`, at: c.lastAt || 0,
    });
  });

  return items.sort((a, b) => GROUP[a.kind] - GROUP[b.kind] || b.at - a.at);
}

// The panel shows the first MAX_ITEMS; `more` is how many were left out.
export const capItems = (items) => ({ shown: items.slice(0, MAX_ITEMS), more: Math.max(0, items.length - MAX_ITEMS) });

// `seen` is an array of keys, oldest first (it is kept on the device).
export const unseenCount = (items, seen) => {
  const known = new Set(seen);
  return items.filter((i) => !known.has(i.key)).length;
};

// Adds every current key. Returns the same array when nothing is new, so a caller can skip the write.
export function markSeen(seen, items) {
  const known = new Set(seen);
  const fresh = items.map((i) => i.key).filter((k) => !known.has(k));
  return fresh.length ? [...seen, ...fresh].slice(-MAX_SEEN) : seen;
}
