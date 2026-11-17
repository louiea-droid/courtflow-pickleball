import { useState } from "react";
import { Plus, Search } from "lucide-react";
import ChatPane, { whenLabel } from "../components/ChatPane";
import NewMessageModal from "../components/NewMessageModal";
import PageTitle from "../components/PageTitle";
import Wave from "../components/Wave";
import { useChatActions } from "../hooks/useChatActions";
import { chatTitle, clubIdOfChat, isUnread, otherMember } from "../utils/chat";
import UserAvatar from "../components/UserAvatar";

import ClubBadge from "../components/ClubBadge";

const href = (id) => (id ? `/inbox/${encodeURIComponent(id)}` : "/inbox");
const TABS = [["all", "All"], ["club", "Clubs"], ["dm", "Direct"]];

// Your conversations (2026-11-17 redesign, owner-approved mockup): the list on the left (title, New message, search,
// All / Clubs / Direct with how many chats are unread), the open chat on the right, both the height of the window.
// On a phone only one of the two shows at a time and fills the screen: the list at /inbox, the chat at /inbox/:chatId.
export default function Inbox({ uid, name, clubs, clubsReady, inbox, chatId, friendships = [], navigate }) {
  const actions = useChatActions({ uid, name });
  const { chats, reads } = inbox;
  const ready = clubsReady && inbox.ready;
  const chat = chats.find((c) => c.id === chatId);
  const [text, setText] = useState("");
  const [tab, setTab] = useState("all");
  const [composing, setComposing] = useState(false);
  const q = text.trim().toLowerCase();
  const unread = (c) => isUnread(c, reads[c.id]?.at, uid);
  const kindOf = (c) => (c.kind === "dm" ? "dm" : "club");
  const shown = chats.filter((c) => (tab === "all" || kindOf(c) === tab)
    && (!q || `${chatTitle(c, uid)} ${c.lastText || ""}`.toLowerCase().includes(q)));
  const unreadIn = (k) => chats.filter((c) => (k === "all" || kindOf(c) === k) && unread(c)).length;
  const go = (to) => (e) => { e.preventDefault(); navigate(to); };
  const canModerate = chat?.kind === "club" ? ["owner", "manager"].includes(clubs.find((c) => c.id === clubIdOfChat(chat.id))?.role) : false;
  const newMessage = (
    <button type="button" className="inbox-new" onClick={() => setComposing(true)}><Plus size={16} /> New message</button>
  );

  return (
    <div>
      <PageTitle title="Inbox" hidden />
      <div className={`inbox${chatId ? " has-chat" : ""}`}>
        <nav className="inbox-list" aria-label="Conversations">
          <div className="inbox-head">
            <div className="inbox-title"><h2>Inbox</h2>{newMessage}</div>
            <label className="inbox-search">
              <Search size={15} />
              <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search chats" aria-label="Search chats" />
            </label>
            <div className="inbox-tabs" role="group" aria-label="Show">
              {TABS.map(([k, label]) => {
                const n = k === "all" ? 0 : unreadIn(k);
                return (
                  <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>
                    {label}{n > 0 && <><em aria-hidden="true">{n}</em><span className="sr-only">, {n} unread</span></>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="inbox-rows">
            {!ready ? (
              <p className="inbox-empty">Loading…</p>
            ) : chats.length === 0 ? (
              <p className="inbox-empty">No conversations yet. A club's chat appears here once a manager starts it; use New message to write to a friend or a club member.</p>
            ) : shown.length === 0 ? (
              <p className="inbox-empty">{q ? "No chat matches that." : tab === "dm" ? "No direct messages yet." : "No club chats yet."}</p>
            ) : shown.map((c) => {
              const isNew = unread(c);
              const clubId = clubIdOfChat(c.id);
              return (
                <a key={c.id} className={`inbox-row${isNew ? " unread" : ""}`} href={href(c.id)} aria-current={c.id === chatId ? "page" : undefined} onClick={go(href(c.id))}>
                  {clubId
                    ? <ClubBadge className="inbox-badge" id={clubId} name={c.title} />
                    : <UserAvatar uid={otherMember(c, uid).id} size={40} className="inbox-badge" />}
                  <span className="inbox-row-main">
                    <span className="inbox-row-top">
                      <b>{chatTitle(c, uid)}</b>
                      {c.lastAt > 0 && <time className="inbox-row-time" dateTime={new Date(c.lastAt).toISOString()}>{whenLabel(c.lastAt)}</time>}
                    </span>
                    <span className="inbox-row-top">
                      <small>{c.lastText ? `${c.lastBy === uid ? "You: " : ""}${c.lastText}` : "No messages yet"}</small>
                      {isNew && <><span className="inbox-dot" aria-hidden="true" /><span className="sr-only">Unread</span></>}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        </nav>

        <div className="inbox-main">
          {chat ? (
            <ChatPane
              key={chat.id} chat={chat} uid={uid} canModerate={canModerate} actions={actions} onBack={() => navigate("/inbox")}
              unread={unread(chat)} navigate={navigate}
            />
          ) : chatId && ready ? (
            <div className="panel inbox-note">
              <p>This chat isn't available.</p>
              <a className="outline" href="/inbox" onClick={go("/inbox")}>Back to your chats</a>
            </div>
          ) : chatId ? (
            <p className="inbox-empty">Loading…</p>
          ) : (
            <div className="inbox-pick">
              <div>
                <h2>Your conversations</h2>
                <p>Pick a chat on the left, or start a new one.</p>
                <div className="inbox-pick-actions">
                  {newMessage}
                  <a className="inbox-pick-ghost" href="/friends" onClick={go("/friends")}>Find friends</a>
                </div>
              </div>
              <Wave className="inbox-pick-wave" />
            </div>
          )}
        </div>
      </div>
      {composing && (
        <NewMessageModal uid={uid} clubs={clubs} friendships={friendships} startDm={actions.startDm} navigate={navigate} close={() => setComposing(false)} />
      )}
    </div>
  );
}
