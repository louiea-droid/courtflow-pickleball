import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, EyeOff, Send, Trash2 } from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { useMessages } from "../hooks/useChats";
import { MESSAGE_MAX, chatTitle, validateMessage } from "../utils/chat";
import { formatDate, formatTime } from "../utils/format";

const COUNTER_FROM = 900;
const NEAR_BOTTOM = 120; // px from the end of the list that still counts as "reading the latest"

export const sameDay = (ms) => new Date(ms).toDateString() === new Date().toDateString();
export const whenLabel = (ms) => (sameDay(ms) ? formatTime(ms) : formatDate(ms));

// One conversation: the messages (plain text, never HTML) and the box to write in. `unread` is whether this
// chat has a line the person hasn't seen; showing it marks it read. `canModerate`: a manager of the club.
export default function ChatPane({ chat, uid, unread, canModerate, actions, onBack, backLabel = "Back to all chats" }) {
  const { messages, ready, hasMore, loadMore } = useMessages(chat.id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(null); // a message about to be deleted
  const [hiding, setHiding] = useState(false); // asking before a direct conversation is hidden
  const title = chatTitle(chat, uid);
  const direct = chat.kind === "dm";
  const listRef = useRef(null);
  const stick = useRef(true); // follow new messages only while the reader is already at the bottom

  // Opening the chat, and each new line from someone else while it is open, marks it read.
  useEffect(() => {
    if (unread) actions.markRead(chat.id, chat.lastAt).catch(() => {});
  }, [chat.id, chat.lastAt, unread]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { stick.current = true; setText(""); setError(""); }, [chat.id]);
  const olderFrom = useRef(null); // the list's height before "Load earlier", to keep the reader where they were
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (olderFrom.current !== null) { el.scrollTop += el.scrollHeight - olderFrom.current; olderFrom.current = null; }
    else if (stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, chat.id]);
  const showEarlier = () => { olderFrom.current = listRef.current.scrollHeight; loadMore(); };
  const onScroll = (e) => {
    const el = e.currentTarget;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
  };

  const send = async () => {
    const problem = validateMessage(text);
    if (busy) return;
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    try {
      await actions.sendMessage(chat, text);
      stick.current = true; // your own message always scrolls into view
      setText("");
    } catch {
      setError("Couldn't send. Your message is still here; check your connection and try again.");
    }
    setBusy(false);
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };
  const confirmHide = async () => {
    setHiding(false);
    try { await actions.hideChat(chat.id, chat.lastAt); onBack(); } catch { setError("Couldn't hide the conversation. Try again."); }
  };
  const confirmRemove = async () => {
    const m = removing;
    setRemoving(null);
    try { await actions.deleteMessage(chat.id, m.id, m.id === messages[messages.length - 1]?.id && chat.lastBy === m.from); } catch { setError("Couldn't delete that message. Try again."); }
  };

  return (
    <section className="chat-pane" aria-label={`Chat: ${title}`}>
      <header className="chat-head">
        <button className="outline chat-back" type="button" onClick={onBack} aria-label={backLabel}><ArrowLeft size={16} /></button>
        <div>
          <h2>{title}</h2>
          {!direct && <p>Only members of this club can read and write here.</p>}
        </div>
        {direct && <button className="outline chat-hide" type="button" onClick={() => setHiding(true)}><EyeOff size={15} /> Hide conversation</button>}
      </header>

      <div className="chat-list" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Messages">
        {!ready ? (
          <p className="chat-empty">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="chat-empty">No messages yet. Say hello.</p>
        ) : <>
          {hasMore && <button className="outline chat-earlier" type="button" onClick={showEarlier}>Load earlier messages</button>}
          {messages.map((m) => {
          const mine = m.from === uid;
          return (
            <article key={m.id} className={`chat-msg${mine ? " mine" : ""}`}>
              <div className="chat-msg-head">
                <b>{mine ? "You" : m.name}</b>
                <time dateTime={new Date(m.createdAt).toISOString()}>{whenLabel(m.createdAt)}</time>
                {(mine || canModerate || direct) && (
                  <button className="chat-msg-del" type="button" aria-label={`Delete message from ${mine ? "you" : m.name}`} onClick={() => setRemoving(m)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p>{m.text}</p>
            </article>
          );
        })}</>}
      </div>

      <div className="chat-composer">
        {error && <p className="chat-error" role="alert">{error}</p>}
        <div className="chat-composer-row">
          <textarea
            value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} rows={2}
            placeholder="Write a message" aria-label="Message" enterKeyHint="send"
          />
          <button className="primary" type="button" onClick={send} disabled={busy || !text.trim()}><Send size={15} /> Send</button>
        </div>
        {text.length >= COUNTER_FROM && (
          <p className={`chat-count${text.trim().length > MESSAGE_MAX ? " over" : ""}`}>{text.trim().length} / {MESSAGE_MAX}</p>
        )}
      </div>

      {hiding && (
        <ConfirmDialog
          title="Hide this conversation?" message="It disappears from your list. A new message from them brings it back." confirmLabel="Hide"
          onCancel={() => setHiding(false)} onConfirm={confirmHide}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Delete this message?" message={direct ? "It is removed for both of you." : "It is removed for everyone in the club."} confirmLabel="Delete"
          onCancel={() => setRemoving(null)} onConfirm={confirmRemove}
        />
      )}
    </section>
  );
}
