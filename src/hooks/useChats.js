import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { clubChatId, sortChats, unreadCount, visibleChats } from "../utils/chat";

// The person's Inbox: the group chat of each of their clubs that has one, their direct conversations, and their
// read positions (which also say which conversations they have hidden).
// One listener per club on the chat document; a chat that doesn't exist yet, or that the rules refuse
// (they left the club), simply isn't in the list. `clubs` are the "My clubs" cards.
export function useInbox(uid, clubs) {
  const [docs, setDocs] = useState({});
  const [reads, setReads] = useState({});
  const [readsReady, setReadsReady] = useState(false);
  const [dms, setDms] = useState(null); // null until the direct-conversation query has answered
  const [answered, setAnswered] = useState({});
  const clubKey = clubs.map((c) => c.id).join("|");

  useEffect(() => {
    setDocs({});
    setAnswered({});
    if (!firebaseConfigured || !uid) return undefined;
    const put = (id, data) => {
      setAnswered((prev) => ({ ...prev, [id]: true }));
      setDocs((prev) => {
        const next = { ...prev };
        if (data) next[id] = data; else delete next[id];
        return next;
      });
    };
    // A refused listener is dead for good. Right after joining by invite link the card shows before the server has the
    // member record, so a first refusal is retried a few times (3 s apart) before the chat is given up as unavailable.
    let stopped = false;
    const offs = {};
    const timers = {};
    const listen = (id, tries) => {
      offs[id] = onSnapshot(
        doc(db, "chats", clubChatId(id)),
        (s) => put(id, s.exists() ? s.data() : null),
        () => {
          put(id, null);
          if (!stopped && tries < 3) timers[id] = setTimeout(() => listen(id, tries + 1), 3000);
        },
      );
    };
    clubKey.split("|").filter(Boolean).forEach((id) => listen(id, 0));
    return () => {
      stopped = true;
      Object.values(offs).forEach((off) => off());
      Object.values(timers).forEach(clearTimeout);
    };
  }, [uid, clubKey]);

  useEffect(() => {
    setReads({});
    setReadsReady(false);
    if (!firebaseConfigured || !uid) return undefined;
    return onSnapshot(
      collection(db, "accounts", uid, "chatReads"),
      (s) => { setReads(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))); setReadsReady(true); },
      () => { setReads({}); setReadsReady(true); },
    );
  }, [uid]);

  // Direct conversations: one query on the people list (a single field, no index). Hidden ones drop out in `chats`.
  useEffect(() => {
    setDms(null);
    if (!firebaseConfigured || !uid) return undefined;
    return onSnapshot(
      query(collection(db, "chats"), where("members", "array-contains", uid)),
      (s) => setDms(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setDms([]),
    );
  }, [uid]);

  const chats = useMemo(() => visibleChats(sortChats([
    ...clubs.filter((c) => docs[c.id]).map((c) => ({ ...docs[c.id], id: clubChatId(c.id), title: c.clubName || docs[c.id].title })),
    ...(dms || []),
  ]), reads), [clubs, docs, dms, reads]);
  // ready: every club and the direct query have answered, so a chat that is missing really is missing.
  const ready = readsReady && dms !== null && clubs.every((c) => answered[c.id]);
  return { chats, reads, ready, unread: unreadCount(chats, reads, uid) };
}

// The latest messages of a chat, oldest first, live: 100 at first, 100 more each time "Load earlier" is used
// (the same query with a bigger limit, so the newest stay live too).
const PAGE = 100;
// The caller keys the screen by chat id, so a new chat starts again at one page.
export function useMessages(chatId) {
  const [state, setState] = useState({ messages: [], ready: false, max: PAGE });
  const [max, setMax] = useState(PAGE);
  useEffect(() => {
    if (!firebaseConfigured || !chatId) return undefined;
    return onSnapshot(
      query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "desc"), limit(max)),
      (s) => setState({ messages: s.docs.map((d) => ({ id: d.id, ...d.data() })).reverse(), ready: true, max }),
      () => setState({ messages: [], ready: true, max }),
    );
  }, [chatId, max]);
  // hasMore compares with the limit the shown messages were loaded under, so the button doesn't blink while a page loads.
  return { messages: state.messages, ready: state.ready, hasMore: state.messages.length >= state.max, loadMore: () => setMax((m) => m + PAGE) };
}
