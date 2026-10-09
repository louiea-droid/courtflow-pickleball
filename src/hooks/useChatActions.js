import { collection, deleteDoc, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { chatTail, clubChatId, messageDoc, validateMessage } from "../utils/chat";

// Every write for chats. Each one rejects on failure; the screens turn that into a message.
// `name` is the signed-in person's name, stored on each message so it survives them leaving.
export function useChatActions({ uid, name }) {
  // The message and the chat's last line go together, so the list and the unread dot never disagree.
  const sendMessage = async (chatId, text) => {
    const problem = validateMessage(text);
    if (problem) throw new Error(problem);
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "chats", chatId, "messages")), messageDoc(uid, name, text, now));
    batch.update(doc(db, "chats", chatId), chatTail(uid, text, now));
    await batch.commit();
  };

  const deleteMessage = (chatId, messageId) => deleteDoc(doc(db, "chats", chatId, "messages", messageId));

  // `lastAt` is the chat's last line: never record a read earlier than it, so another phone's clock can't leave a dot behind.
  const markRead = (chatId, lastAt = 0) => setDoc(doc(db, "accounts", uid, "chatReads", chatId), { at: Math.max(Date.now(), lastAt) });

  // A manager turns the club's group chat on.
  const startClubChat = (club) => setDoc(doc(db, "chats", clubChatId(club.id)), {
    kind: "club", clubId: club.id, title: club.name, lastText: "", lastAt: 0, lastBy: "", createdAt: Date.now(),
  });

  return { sendMessage, deleteMessage, markRead, startClubChat };
}
