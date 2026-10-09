import { collection, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { chatTail, clubChatId, clubIdOfChat, messageDoc, validateMessage } from "../utils/chat";

// Every write for chats. Each one rejects on failure; the screens turn that into a message.
// Each message carries the sender's name from their club member record (the rules require exactly that, so nobody can
// post as someone else); it is stored on the message so it survives them leaving. `name` is only the fallback.
export function useChatActions({ uid, name }) {
  // The message and the chat's last line go together, so the list and the unread dot never disagree.
  const sendMessage = async (chatId, text) => {
    const problem = validateMessage(text);
    if (problem) throw new Error(problem);
    const now = Date.now();
    const member = await getDoc(doc(db, "clubs", clubIdOfChat(chatId), "members", uid));
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "chats", chatId, "messages")), messageDoc(uid, member.data()?.name || name, text, now));
    batch.update(doc(db, "chats", chatId), chatTail(uid, text, now));
    await batch.commit();
  };

  // Deleting the newest message also rewrites the chat's last line, so the list doesn't keep showing it.
  const deleteMessage = async (chatId, messageId, isNewest = false) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, "chats", chatId, "messages", messageId));
    if (isNewest) batch.update(doc(db, "chats", chatId), { lastText: "Message deleted" });
    await batch.commit();
  };

  // `lastAt` is the chat's last line: never record a read earlier than it, so another phone's clock can't leave a dot behind.
  const markRead = (chatId, lastAt = 0) => setDoc(doc(db, "accounts", uid, "chatReads", chatId), { at: Math.max(Date.now(), lastAt) });

  // A manager turns the club's group chat on.
  const startClubChat = (club) => setDoc(doc(db, "chats", clubChatId(club.id)), {
    kind: "club", clubId: club.id, title: club.name, lastText: "", lastAt: 0, lastBy: "", createdAt: Date.now(),
  });

  return { sendMessage, deleteMessage, markRead, startClubChat };
}
