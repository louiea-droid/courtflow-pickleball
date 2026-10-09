import { collection, doc, getDoc, getDocFromCache, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { chatTail, clubChatId, clubIdOfChat, dmChatDoc, dmChatId, messageDoc, validateMessage } from "../utils/chat";

// Every write for chats. Each one rejects on failure; the screens turn that into a message.
// Each message carries the sender's name from their club member record (the rules require exactly that, so nobody can
// post as someone else); it is stored on the message so it survives them leaving. `name` is only the fallback.
export function useChatActions({ uid, name }) {
  // The message and the chat's last line go together, so the list and the unread dot never disagree.
  // `chat` is the open conversation from the Inbox list. The name on the message is the conversation's own for a direct
  // message (already in hand), and your member record for a club chat (read from the local cache first, so sending
  // costs no extra round trip and still works offline once the Members tab has been seen).
  const sendMessage = async (chat, text) => {
    const problem = validateMessage(text);
    if (problem) throw new Error(problem);
    const now = Date.now();
    let senderName = chat.names?.[uid];
    if (chat.kind !== "dm") {
      const ref = doc(db, "clubs", clubIdOfChat(chat.id), "members", uid);
      senderName = (await getDocFromCache(ref).catch(() => getDoc(ref))).data()?.name;
    }
    const batch = writeBatch(db);
    const messageRef = doc(collection(db, "chats", chat.id, "messages"));
    batch.set(messageRef, messageDoc(uid, senderName || name, text, now));
    batch.update(doc(db, "chats", chat.id), chatTail(uid, text, now, messageRef.id));
    await batch.commit();
  };

  // Deleting the newest message also rewrites the chat's last line, so the list doesn't keep showing it.
  const deleteMessage = async (chatId, messageId, isNewest = false) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, "chats", chatId, "messages", messageId));
    if (isNewest) batch.update(doc(db, "chats", chatId), { lastText: "Message deleted" });
    await batch.commit();
  };

  // "Read up to the chat's last line": `at` is that line's own time, not this device's clock, so a fast or slow clock
  // can neither hide the next message's dot nor leave one behind.
  const markRead = (chatId, lastAt = 0) => setDoc(doc(db, "accounts", uid, "chatReads", chatId), { at: lastAt });

  // Opens the direct conversation with someone (starting it if it isn't there) and resolves to its id. `names` is
  // { me, other } as they appear on the source the rules check: the friendship's `names`, or the two member records
  // when `viaClub` names a shared club. A hidden conversation is shown again.
  const startDm = async (otherId, names, viaClub) => {
    const id = dmChatId(uid, otherId);
    const ref = doc(db, "chats", id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await setDoc(doc(db, "accounts", uid, "chatReads", id), { at: existing.data().lastAt || 0 });
      return id;
    }
    try {
      await setDoc(ref, dmChatDoc(uid, names.me, otherId, names.other, Date.now(), viaClub));
    } catch (err) {
      // The other person pressed Message at the same moment and their conversation won: just open it.
      if (!(await getDoc(ref).catch(() => null))?.exists()) throw err;
    }
    return id;
  };

  // Hides a conversation from this person's list only; a newer message brings it back.
  // `at` is the chat's last line, so any newer line (by its own time, whatever the clocks say) brings it back.
  const hideChat = (chatId, lastAt = 0) => setDoc(doc(db, "accounts", uid, "chatReads", chatId), { at: lastAt, hidden: true });

  // A manager turns the club's group chat on.
  const startClubChat = (club) => setDoc(doc(db, "chats", clubChatId(club.id)), {
    kind: "club", clubId: club.id, title: club.name, lastText: "", lastAt: 0, lastBy: "", createdAt: Date.now(),
  });

  return { sendMessage, deleteMessage, markRead, startClubChat, startDm, hideChat };
}
