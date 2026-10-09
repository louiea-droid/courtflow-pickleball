import { MessageSquare } from "lucide-react";
import ChatPane, { whenLabel } from "../components/ChatPane";
import PageTitle from "../components/PageTitle";
import { useChatActions } from "../hooks/useChatActions";
import { clubIdOfChat, isUnread } from "../utils/chat";

const href = (id) => (id ? `/inbox/${encodeURIComponent(id)}` : "/inbox");

// Your conversations: the list on the left (club chats first), the open chat on the right. On a phone only one
// of the two shows at a time: the list at /inbox, the chat at /inbox/:chatId.
export default function Inbox({ uid, name, clubs, clubsReady, inbox, chatId, navigate }) {
  const actions = useChatActions({ uid, name });
  const { chats, reads } = inbox;
  const ready = clubsReady && inbox.ready;
  const chat = chats.find((c) => c.id === chatId);
  const go = (to) => (e) => { e.preventDefault(); navigate(to); };
  const canModerate = chat ? ["owner", "manager"].includes(clubs.find((c) => c.id === clubIdOfChat(chat.id))?.role) : false;

  return (
    <div>
      <PageTitle title="Inbox" sub="Chats with your clubs." />
      <div className={`inbox${chatId ? " has-chat" : ""}`}>
        <nav className="inbox-list" aria-label="Conversations">
          {!ready ? (
            <p className="inbox-empty">Loading…</p>
          ) : chats.length === 0 ? (
            <p className="inbox-empty">No conversations yet. A club's chat appears here once a manager starts it.</p>
          ) : chats.map((c) => {
            const unread = isUnread(c, reads[c.id]?.at, uid);
            return (
              <a key={c.id} className="inbox-row" href={href(c.id)} aria-current={c.id === chatId ? "page" : undefined} onClick={go(href(c.id))}>
                <span className="inbox-row-main">
                  <b>{c.title}</b>
                  <small>{c.lastText ? `${c.lastBy === uid ? "You: " : ""}${c.lastText}` : "No messages yet"}</small>
                </span>
                {c.lastAt > 0 && <time className="inbox-row-time" dateTime={new Date(c.lastAt).toISOString()}>{whenLabel(c.lastAt)}</time>}
                {unread && <><span className="inbox-dot" aria-hidden="true" /><span className="sr-only">Unread</span></>}
              </a>
            );
          })}
        </nav>

        <div className="inbox-main">
          {chat ? (
            <ChatPane
              chat={chat} uid={uid} canModerate={canModerate} actions={actions} onBack={() => navigate("/inbox")}
              unread={isUnread(chat, reads[chat.id]?.at, uid)}
            />
          ) : chatId && ready ? (
            <div className="panel inbox-note">
              <p>This chat isn't available.</p>
              <a className="outline" href="/inbox" onClick={go("/inbox")}>Back to your chats</a>
            </div>
          ) : chatId ? (
            <p className="inbox-empty">Loading…</p>
          ) : (
            <div className="inbox-note inbox-pick"><MessageSquare size={22} /><p>Pick a chat to read it.</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
