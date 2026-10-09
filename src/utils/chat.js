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
