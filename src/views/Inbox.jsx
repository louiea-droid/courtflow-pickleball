import { useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import ChatPane, { whenLabel } from "../components/ChatPane";
import PageTitle from "../components/PageTitle";
import { useChatActions } from "../hooks/useChatActions";
import { chatTitle, clubIdOfChat, isUnread } from "../utils/chat";
import { badgeColor, clubInitial } from "../utils/clubs";

const href = (id) => (id ? `/inbox/${encodeURIComponent(id)}` : "/inbox");

// Your conversations: the list on the left (club chats first), the open chat on the right. On a phone only one
// of the two shows at a time: the list at /inbox, the chat at /inbox/:chatId.
export default function Inbox({ uid, name, clubs, clubsReady, inbox, chatId, navigate }) {
  const actions = useChatActions({ uid, name });
  const { chats, reads } = inbox;
  const ready = clubsReady && inbox.ready;
  const chat = chats.find((c) => c.id === chatId);
  const [text, setText] = useState("");
  const q = text.trim().toLowerCase();
  const shown = q ? chats.filter((c) => `${chatTitle(c, uid)} ${c.lastText || ""}`.toLowerCase().includes(q)) : chats;
  const go = (to) => (e) => { e.preventDefault(); navigate(to); };
  const canModerate = chat?.kind === "club" ? ["owner", "manager"].includes(clubs.find((c) => c.id === clubIdOfChat(chat.id))?.role) : false;

  return (
    <div>
      <PageTitle title="Inbox" sub="Chats with your clubs, friends and club members." />
      <div className={`inbox${chatId ? " has-chat" : ""}`}>
        <nav className="inbox-list" aria-label="Conversations">
          {ready && chats.length > 3 && (
            <label className="inbox-search">
              <Search size={15} />
              <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search chats" aria-label="Search chats" />
            </label>
          )}
          {!ready ? (
            <p className="inbox-empty">Loading…</p>
          ) : chats.length === 0 ? (
            <p className="inbox-empty">No conversations yet. A club's chat appears here once a manager starts it, and you can message friends and club members.</p>
          ) : shown.length === 0 ? (
            <p className="inbox-empty">No chat matches that.</p>
          ) : shown.map((c) => {
            const unread = isUnread(c, reads[c.id]?.at, uid);
            const clubId = clubIdOfChat(c.id);
            return (
              <a key={c.id} className={`inbox-row${unread ? " unread" : ""}`} href={href(c.id)} aria-current={c.id === chatId ? "page" : undefined} onClick={go(href(c.id))}>
                {clubId
                  ? <span className="inbox-badge" style={{ background: badgeColor(clubId) }} aria-hidden="true">{clubInitial(c.title)}</span>
                  : <span className="inbox-badge dm" aria-hidden="true"><MessageSquare size={16} /></span>}
                <span className="inbox-row-main">
                  <b>{chatTitle(c, uid)}</b>
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
              key={chat.id} chat={chat} uid={uid} canModerate={canModerate} actions={actions} onBack={() => navigate("/inbox")}
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
