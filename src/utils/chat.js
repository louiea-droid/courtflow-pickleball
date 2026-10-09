// Pure rules for chats: ids, message validation, the one-line preview and what counts as unread.
// No Firestore here (that is useChats / useChatActions), so all of it is covered by chat.check.mjs.

export const MESSAGE_MAX = 1000;
const PREVIEW_MAX = 100;

// A club's group chat is chats/club_{clubId}.
export const clubChatId = (clubId) => `club_${clubId}`;
export const clubIdOfChat = (chatId = "") => (chatId.startsWith("club_") && chatId.length > 5 ? chatId.slice(5) : null);

export function validateMessage(text = "") {
  const t = text.trim();
  if (!t) return "Write a message first.";
  if (t.length > MESSAGE_MAX) return `Messages can be up to ${MESSAGE_MAX} characters.`;
  return "";
}

// A message as stored; `name` is the sender's name at the time, so it survives them leaving.
export const messageDoc = (uid, name, text, now) => ({
  from: uid,
  name: (name || "").trim().slice(0, 60) || "Member",
  text: text.trim(),
  createdAt: now,
});

export const chatPreview = (text = "") => text.replace(/\s+/g, " ").trim().slice(0, PREVIEW_MAX);
export const chatTail = (uid, text, now) => ({ lastText: chatPreview(text), lastAt: now, lastBy: uid });

// Unread = a line newer than the person's read position that someone else wrote.
export const isUnread = (chat, readAt, uid) => chat.lastAt > (readAt || 0) && chat.lastBy !== uid;

// Club chats first (by title), then everything else, newest first.
export function sortChats(chats) {
  const club = chats.filter((c) => c.kind === "club").sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  const rest = chats.filter((c) => c.kind !== "club").sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
  return [...club, ...rest];
}

export const unreadCount = (chats, reads, uid) => chats.filter((c) => isUnread(c, reads[c.id]?.at, uid)).length;

// ---- Direct messages: chats/dm_{a}_{b} (the two uids sorted), shown in the same list as the club chats.
export const dmChatId = (a, b) => (a < b ? `dm_${a}_${b}` : `dm_${b}_${a}`);

// \`names\` holds each person's name as it was when the conversation started (so it survives either leaving);
// \`viaClub\` is the club the two share when they are not friends.
export const dmChatDoc = (me, meName, other, otherName, now, viaClub) => ({
  kind: "dm",
  members: [me, other].sort(),
  names: { [me]: (meName || "").trim().slice(0, 60) || "Member", [other]: (otherName || "").trim().slice(0, 60) || "Member" },
  lastText: "",
  lastAt: 0,
  lastBy: "",
  createdAt: now,
  ...(viaClub ? { viaClub } : {}),
});

export function otherMember(chat, uid) {
  const id = chat.members.find((m) => m !== uid);
  return { id, name: chat.names?.[id] || "Member" };
}
export const chatTitle = (chat, uid) => (chat.kind === "dm" ? otherMember(chat, uid).name : chat.title);

// Hidden is per person (chatReads/{chatId}.hidden); a message newer than the hiding brings the chat back.
export const isHidden = (readInfo, chat) => Boolean(readInfo?.hidden) && (chat.lastAt || 0) <= (readInfo.at || 0);
export const visibleChats = (chats, reads) => chats.filter((c) => !isHidden(reads[c.id], c));
