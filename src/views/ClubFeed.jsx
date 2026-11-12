import { useRef, useState } from "react";
import { Heart, ImagePlus, MessageCircle, Pin, Send, X } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import DateTile from "../components/DateTile";
import RowMenu from "../components/RowMenu";
import Wave from "../components/Wave";
import { usePostPhoto, useReplies } from "../hooks/useFeed";
import { byStart, isListed } from "../utils/bookings";
import { POST_MAX, REPLY_MAX, feedOrder, feedStatus, filterFeed, hasHeart, heartsOf, isAnnouncement, isPinned, roleTag } from "../utils/feed";
import { formatDate, formatTime } from "../utils/format";

const when = (ms) => `${formatDate(ms)} at ${formatTime(ms)}`;
const errorText = (err, fallback) => (/^(Write|Posts|Replies|Choose|That|Couldn't find)/.test(err?.message || "") ? err.message : fallback);

function Composer({ canManage, onPublish }) {
  const [text, setText] = useState("");
  const [announcement, setAnnouncement] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);
  const pick = (f) => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onPublish({ text, announcement: canManage && announcement, file });
      setText("");
      setAnnouncement(false);
      pick(null);
    } catch (err) {
      setError(errorText(err, "Couldn't post. Check your connection and try again."));
    }
    setBusy(false);
  };
  return (
    <form className="panel feed-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="feed-text">Write a post</label>
      <textarea
        id="feed-text" value={text} maxLength={POST_MAX} rows={3}
        onChange={(e) => setText(e.target.value)} placeholder="Share something with the club"
      />
      {preview && (
        <div className="feed-composer-photo">
          <img src={preview} alt="Photo to post" />
          <button type="button" className="glass-btn" aria-label="Remove photo" onClick={() => pick(null)}><X size={15} /></button>
        </div>
      )}
      {error && <p className="op-error" role="alert">{error}</p>}
      <div className="feed-composer-foot">
        <button type="button" className="outline" onClick={() => input.current?.click()}><ImagePlus size={15} /> {file ? "Change photo" : "Add photo"}</button>
        <input ref={input} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pick(f); }} />
        {canManage && (
          <label className="feed-announce">
            <span className="switch">
              <input type="checkbox" role="switch" checked={announcement} onChange={(e) => setAnnouncement(e.target.checked)} />
            </span>
            Announcement
          </label>
        )}
        <small className="feed-count">{text.length} / {POST_MAX}</small>
        <button className="primary feed-post-btn" type="submit" disabled={busy || !text.trim()}>
          <Send size={14} /> {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

function PostPhoto({ clubId, post }) {
  const image = usePostPhoto(clubId, post.hasPhoto ? post.id : null);
  if (!post.hasPhoto) return null;
  return (
    <div className="feed-photo">
      {image ? <img src={image} alt={`Photo from ${post.authorName}`} loading="lazy" /> : <span className="feed-photo-wait" aria-label="Loading photo" />}
    </div>
  );
}

function Replies({ clubId, post, uid, canManage, actions, onAsk }) {
  const replies = useReplies(clubId, post.id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setText(""); // cleared at once (the write may wait for the server); put back if it fails
    try { await actions.reply(post, text); } catch (err) { setText(text); setError(errorText(err, "Couldn't send the reply. Try again.")); }
    setBusy(false);
  };
  return (
    <div className="feed-replies">
      {replies.map((r) => (
        <div className="feed-reply" key={r.id}>
          <div className="feed-reply-head">
            <b>{r.authorName}</b>
            <time dateTime={new Date(r.createdAt).toISOString()}>{when(r.createdAt)}</time>
            {(r.authorId === uid || post.authorId === uid || canManage) && (
              <RowMenu label={`More for the reply from ${r.authorName}`}
                items={[{ label: "Delete reply", danger: true, onSelect: () => onAsk({ kind: "reply", post, reply: r }) }]} />
            )}
          </div>
          <p>{r.text}</p>
        </div>
      ))}
      <form className="feed-reply-form" onSubmit={send}>
        <label className="sr-only" htmlFor={`reply-${post.id}`}>Write a reply</label>
        <input id={`reply-${post.id}`} value={text} maxLength={REPLY_MAX} onChange={(e) => setText(e.target.value)} placeholder="Write a reply" />
        <button className="feed-send" type="submit" disabled={busy || !text.trim()} aria-label="Send reply"><Send size={16} /></button>
      </form>
      {error && <p className="op-error" role="alert">{error}</p>}
    </div>
  );
}

function Post({ clubId, post, uid, canManage, now, actions, onAsk, notify }) {
  const [open, setOpen] = useState(false);
  const mine = hasHeart(post, uid);
  const hearts = heartsOf(post).length;
  const replies = post.replyCount || 0;
  const ann = isAnnouncement(post);
  const heart = () => actions.toggleHeart(post).catch(() => notify("Couldn't save the heart. Try again.", 4000));
  return (
    <article className={`panel feed-post${ann ? " is-announcement" : ""}`}>
      <div className="feed-post-head">
        <b>{post.authorName}</b>
        <span className={`feed-role${post.authorRole === "member" ? " soft" : ""}`}>{roleTag(post)}</span>
        <time dateTime={new Date(post.createdAt).toISOString()}>{when(post.createdAt)}</time>
        {(post.authorId === uid || canManage) && (
          <RowMenu label={`More for the post from ${post.authorName}`}
            items={[{ label: "Delete post", danger: true, onSelect: () => onAsk({ kind: "post", post }) }]} />
        )}
      </div>
      {ann && (
        <span className="feed-ann-tag">{isPinned(post, now) && <Pin size={13} aria-label="Pinned" />} Announcement</span>
      )}
      <p className="feed-text">{post.text}</p>
      <PostPhoto clubId={clubId} post={post} />
      <div className="feed-post-foot">
        <button type="button" className={`feed-act${mine ? " on" : ""}`} aria-pressed={mine} onClick={heart}
          aria-label={`${mine ? "Remove your heart" : "Heart this post"}, ${hearts} heart${hearts === 1 ? "" : "s"}`}>
          <Heart size={17} fill={mine ? "currentColor" : "none"} /> {hearts > 0 && hearts}
        </button>
        <button type="button" className="feed-act" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <MessageCircle size={17} /> {replies === 0 ? "Reply" : `${replies} ${replies === 1 ? "reply" : "replies"}`}
        </button>
      </div>
      {open && <Replies clubId={clubId} post={post} uid={uid} canManage={canManage} actions={actions} onAsk={onAsk} />}
    </article>
  );
}

function NextGame({ club, clubId, events, fallbackZone, canManage, base, navigate }) {
  const next = events.filter((e) => isListed(e, fallbackZone)).sort(byStart)[0];
  if (!next) return null;
  const left = Math.max(0, (next.maxPlayers || 0) - (next.attendees || []).length);
  const href = canManage ? `${base}/event/${next.id}`
    : club.visibility === "public" ? `/open-play?club=${encodeURIComponent(clubId)}&event=${encodeURIComponent(next.id)}` : null;
  const body = (
    <>
      <DateTile date={next.date} />
      <span><b>{next.title}</b><small>{next.maxPlayers ? (left ? `${left} spot${left === 1 ? "" : "s"} left` : "Full") : "Walk in"}</small></span>
    </>
  );
  return (
    <section className="panel feed-side-card">
      <h2 className="club-section">Next game</h2>
      {href ? (
        <a className="feed-next" href={href} onClick={canManage ? (e) => { e.preventDefault(); navigate(href); } : undefined}>{body}</a>
      ) : <div className="feed-next">{body}</div>}
    </section>
  );
}

// The club feed: every member posts; managers can make a post an announcement (pinned for 7 days); hearts and replies.
export default function ClubFeed({ feed, actions, clubId, uid, canManage, club, events, fallbackZone, base, navigate, notify }) {
  const [filter, setFilter] = useState("all");
  const [asking, setAsking] = useState(null); // { kind: "post" | "reply", post, reply? }
  const shown = filterFeed(feedOrder(feed.posts, feed.pinned, feed.now), filter);
  const status = feedStatus(feed, shown);

  const publish = async (input) => { await actions.publish(input); notify("Posted."); };
  const confirmDelete = async () => {
    const a = asking;
    setAsking(null);
    try {
      if (a.kind === "post") { await actions.removePost(a.post); notify("Post deleted."); }
      else { await actions.removeReply(a.post, a.reply.id); notify("Reply deleted."); }
    } catch {
      notify("Couldn't delete it. Check your connection and try again.", 4000);
    }
  };

  return (
    <div className="feed-layout">
      <div className="feed-main">
        <Composer canManage={canManage} onPublish={publish} />
        <div className="fee-chips feed-filters" role="group" aria-label="Show">
          {[["all", "All"], ["announcements", "Announcements"]].map(([key, label]) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
        {status === "error" ? (
          <p className="feed-state" role="status">Couldn't load the feed. Check your connection and try again.</p>
        ) : status === "loading" ? (
          <p className="feed-state">Loading the feed…</p>
        ) : status === "empty" ? (
          filter === "all" ? (
            <section className="host-empty feed-empty">
              <h2>No posts <span>yet.</span></h2>
              <p>Say hello, share a photo from last game, or post a reminder.</p>
              <Wave />
            </section>
          ) : <p className="feed-state">No announcements yet.</p>
        ) : (
          shown.map((p) => (
            <Post key={p.id} clubId={clubId} post={p} uid={uid} canManage={canManage} now={feed.now}
              actions={actions} onAsk={setAsking} notify={notify} />
          ))
        )}
        {feed.hasMore && feed.posts.length > 0 && (
          <button type="button" className="outline feed-more" onClick={feed.loadMore}>Load earlier posts</button>
        )}
      </div>
      <aside className="feed-side">
        {club.description && (
          <section className="panel feed-side-card">
            <h2 className="club-section">About</h2>
            <p>{club.description}</p>
          </section>
        )}
        <NextGame club={club} clubId={clubId} events={events} fallbackZone={fallbackZone} canManage={canManage} base={base} navigate={navigate} />
      </aside>
      {asking && (
        <ConfirmDialog
          title={asking.kind === "post" ? "Delete this post?" : "Delete this reply?"}
          message={asking.kind === "post" ? "Its replies and photo go too." : "It will be removed for everyone."}
          confirmLabel={asking.kind === "post" ? "Delete post" : "Delete reply"}
          onCancel={() => setAsking(null)} onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
