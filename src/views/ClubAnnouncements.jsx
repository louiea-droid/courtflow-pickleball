import { useState } from "react";
import { ChevronRight, Megaphone, Send, Trash2 } from "lucide-react";
import ConfirmDialog from "../components/ConfirmDialog";
import { formatDate, formatTime } from "../utils/format";

export default function ClubAnnouncements({
  announcements, ready, error, canManage, onPublish, onRemove, preview = false, onViewAll,
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [removing, setRemoving] = useState(null);

  const publish = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      await onPublish(text);
      setText("");
    } catch (err) {
      setFormError(err.message || "Couldn't post the announcement. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const id = removing;
    setRemoving(null);
    try {
      await onRemove(id);
    } catch {
      setFormError("Couldn't delete the announcement. Try again.");
    }
  };

  return (
    <section className={`panel club-announcements${preview ? " preview" : ""}`} aria-labelledby={preview ? "club-announcements-preview-title" : "club-announcements-title"}>
      <div className="panel-row">
        <h2 className="club-section" id={preview ? "club-announcements-preview-title" : "club-announcements-title"}>
          {preview ? "Latest announcements" : "Announcements"}
        </h2>
        {preview && onViewAll && (
          <button className="club-announcements-more" type="button" onClick={onViewAll}>
            View all <ChevronRight size={15} />
          </button>
        )}
      </div>

      {!preview && canManage && (
        <form className="announcement-form" onSubmit={publish}>
          <label htmlFor="club-announcement-text">Post an update</label>
          <textarea
            id="club-announcement-text" value={text} maxLength={2000} rows={3}
            onChange={(event) => setText(event.target.value)}
            placeholder="Share news, reminders, or a note for your club."
          />
          <div className="announcement-form-foot">
            <small>{text.length} / 2000</small>
            <button className="primary" type="submit" disabled={busy || !text.trim()}>
              <Send size={14} /> {busy ? "Posting…" : "Post announcement"}
            </button>
          </div>
        </form>
      )}

      {formError && <p className="announcement-error" role="alert">{formError}</p>}
      {error ? (
        <p className="announcement-state" role="status">Couldn't load announcements. Check your connection and try again.</p>
      ) : !ready ? (
        <p className="announcement-state">Loading announcements…</p>
      ) : announcements.length === 0 ? (
        <div className="announcement-state">
          <Megaphone size={18} />
          <p>{preview ? "Club updates will show here." : canManage ? "Share the first update with your club." : "There are no announcements yet."}</p>
        </div>
      ) : (
        <div className="announcement-list">
          {announcements.map((item) => (
            <article className="announcement-item" key={item.id}>
              <div className="announcement-meta">
                <b>{item.authorName}</b>
                <time dateTime={new Date(item.createdAt).toISOString()}>
                  {formatDate(item.createdAt)} at {formatTime(item.createdAt)}
                </time>
                {canManage && (
                  <button
                    className="announcement-delete" type="button"
                    aria-label={`Delete announcement from ${item.authorName}`}
                    onClick={() => setRemoving(item.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      )}

      {removing && (
        <ConfirmDialog
          title="Delete this announcement?"
          message="It will be removed from the club feed and overview."
          confirmLabel="Delete announcement"
          onCancel={() => setRemoving(null)}
          onConfirm={remove}
        />
      )}
    </section>
  );
}
