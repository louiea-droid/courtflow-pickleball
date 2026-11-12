// The club feed (clubs/{id}/announcements): order, pins, hearts and text rules. Pure, checked by feed.check.mjs.
export const PIN_MS = 7 * 86400000; // an announcement stays on top for 7 days
export const NEW_MS = 86400000;
export const POST_MAX = 2000;
export const REPLY_MAX = 1000;
export const PAGE = 20;

// Posts written before the feed have no `announcement` field; only managers could post then.
export const isAnnouncement = (post) => post.announcement !== false;
export const isPinned = (post, now) => isAnnouncement(post) && now - post.createdAt < PIN_MS;
export const isNew = (post, now) => now - post.createdAt < NEW_MS;

const newestFirst = (a, b) => b.createdAt - a.createdAt;

// Pinned announcements (from their own 7-day query) first, then the page, each post once.
export function feedOrder(posts, pinned, now) {
  const top = pinned.filter((p) => isPinned(p, now)).sort(newestFirst);
  const ids = new Set(top.map((p) => p.id));
  return [...top, ...posts.filter((p) => !ids.has(p.id)).sort(newestFirst)];
}

export const filterFeed = (posts, filter) => (filter === "announcements" ? posts.filter(isAnnouncement) : posts);

export const heartsOf = (post) => post.hearts || [];
export const hasHeart = (post, uid) => heartsOf(post).includes(uid);

const ROLE_TAGS = { owner: "Owner", manager: "Manager", member: "Member" };
export const roleTag = (post) => ROLE_TAGS[post.authorRole] || "Manager";

export function cleanText(text, max) {
  const body = (text || "").trim();
  if (!body) throw new Error("Write something first.");
  if (body.length > max) throw new Error(`${max === REPLY_MAX ? "Replies" : "Posts"} can be up to ${max} characters.`);
  return body;
}

// What the feed shows: posts already on screen stay while the next page loads; "loading" only on a first load.
// `shown` is the list after pins and filters (defaults to the page).
export function feedStatus(state, shown = state.posts) {
  if (state.error) return "error";
  if (shown.length) return "list";
  return state.ready ? "empty" : "loading";
}
