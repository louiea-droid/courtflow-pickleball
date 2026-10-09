import { collection, doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { chatTail, clubChatId, clubIdOfChat, dmChatDoc, dmChatId, messageDoc, validateMessage } from "../utils/chat";

// Every write for chats. Each one rejects on failure; the screens turn that into a message.
// Each message carries the sender's name from their club member record (the rules require exactly that, so nobody can
// post as someone else); it is stored on the message so it survives them leaving. `name` is only the fallback.
export function useChatActions({ uid, name }) {
  // The message and the chat's last line go together, so the list and the unread dot never disagree.
  const sendMessage = async (chatId, text) => {
    const problem = validateMessage(text);
    if (problem) throw new Error(problem);
    const now = Date.now();
    // The name on the message: your member record (club chat) or the name your conversation holds (direct message).
    const clubId = clubIdOfChat(chatId);
    const source = clubId ? await getDoc(doc(db, "clubs", clubId, "members", uid)) : await getDoc(doc(db, "chats", chatId));
    const senderName = clubId ? source.data()?.name : source.data()?.names?.[uid];
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "chats", chatId, "messages")), messageDoc(uid, senderName || name, text, now));
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

  // Opens the direct conversation with someone (starting it if it isn't there) and resolves to its id. `names` is
  // { me, other } as they appear on the source the rules check: the friendship's `names`, or the two member records
  // when `viaClub` names a shared club. A hidden conversation is shown again.
  const startDm = async (otherId, names, viaClub) => {
    const id = dmChatId(uid, otherId);
    const ref = doc(db, "chats", id);
    if ((await getDoc(ref)).exists()) {
      await setDoc(doc(db, "accounts", uid, "chatReads", id), { at: Date.now() });
    } else {
      await setDoc(ref, dmChatDoc(uid, names.me, otherId, names.other, Date.now(), viaClub));
    }
    return id;
  };

  // Hides a conversation from this person's list only; a newer message brings it back.
  const hideChat = (chatId, lastAt = 0) => setDoc(doc(db, "accounts", uid, "chatReads", chatId), { at: Math.max(Date.now(), lastAt), hidden: true });

  // A manager turns the club's group chat on.
  const startClubChat = (club) => setDoc(doc(db, "chats", clubChatId(club.id)), {
    kind: "club", clubId: club.id, title: club.name, lastText: "", lastAt: 0, lastBy: "", createdAt: Date.now(),
  });

  return { sendMessage, deleteMessage, markRead, startClubChat, startDm, hideChat };
}
