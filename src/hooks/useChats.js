import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { clubChatId, sortChats, unreadCount } from "../utils/chat";

// The person's Inbox: the group chat of each of their clubs that has one, plus their read positions.
// One listener per club on the chat document; a chat that doesn't exist yet, or that the rules refuse
// (they left the club), simply isn't in the list. `clubs` are the "My clubs" cards.
export function useInbox(uid, clubs) {
  const [docs, setDocs] = useState({});
  const [reads, setReads] = useState({});
  const [ready, setReady] = useState(false);
  const clubKey = clubs.map((c) => c.id).join("|");

  useEffect(() => {
    setDocs({});
    if (!firebaseConfigured || !uid) return undefined;
    const put = (id, data) => setDocs((prev) => {
      const next = { ...prev };
      if (data) next[id] = data; else delete next[id];
      return next;
    });
    const offs = clubKey.split("|").filter(Boolean).map((id) => onSnapshot(
      doc(db, "chats", clubChatId(id)),
      (s) => put(id, s.exists() ? s.data() : null),
      () => put(id, null),
    ));
    return () => offs.forEach((off) => off());
  }, [uid, clubKey]);

  useEffect(() => {
    setReads({});
    setReady(false);
    if (!firebaseConfigured || !uid) return undefined;
    return onSnapshot(
      collection(db, "accounts", uid, "chatReads"),
      (s) => { setReads(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))); setReady(true); },
      () => { setReads({}); setReady(true); },
    );
  }, [uid]);

  const chats = useMemo(() => sortChats(clubs.filter((c) => docs[c.id]).map((c) => (
    { ...docs[c.id], id: clubChatId(c.id), title: c.clubName || docs[c.id].title }
  ))), [clubs, docs]);
  return { chats, reads, ready, unread: unreadCount(chats, reads, uid) };
}

// The last 100 messages of a chat, oldest first, live. ponytail: older messages aren't loadable; add
// "Load older" with a cursor when a chat outgrows 100.
export function useMessages(chatId) {
  const [state, setState] = useState({ messages: [], ready: false });
  useEffect(() => {
    setState({ messages: [], ready: false });
    if (!firebaseConfigured || !chatId) return undefined;
    return onSnapshot(
      query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), limit(100)),
      (s) => setState({ messages: s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse(), ready: true }),
      () => setState({ messages: [], ready: true }),
    );
  }, [chatId]);
  return state;
}
