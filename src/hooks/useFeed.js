import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  arrayRemove, arrayUnion, collection, doc, getDoc, getDocFromCache, increment, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import { useDocs, docsOf } from "./useLiveDocs";
import { PAGE, PIN_MS, POST_MAX, REPLY_MAX, cleanText, hasHeart, isPinned } from "../utils/feed";
import { deletePostBatch, postRef } from "../utils/feedData";
import { PHOTO_LIMITS, PHOTO_STEPS } from "../utils/clubPhoto";
import { compressImage } from "../utils/receipt";

const posts = (clubId) => collection(db, "clubs", clubId, "announcements");

// The club feed: the newest `n` posts (n grows by PAGE), plus the announcements of the last 7 days, which are pinned
// even when they are older than the page. Only members can read it (rules).
export function useFeed(clubId) {
  const [n, setN] = useState(PAGE);
  const [state, setState] = useState({ posts: [], ready: false, error: false });
  const [pinned, setPinned] = useState([]);
  // The clock for pins and "New": ClubApp stays mounted across tabs, so refresh it hourly.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 3600000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setN(PAGE); setState({ posts: [], ready: false, error: false }); setPinned([]); }, [clubId]);
  useEffect(() => {
    // A bigger page keeps the posts on screen until it arrives (feedStatus).
    setState((s) => ({ ...s, ready: false }));
    if (!firebaseConfigured || !clubId) return undefined;
    return onSnapshot(
      query(posts(clubId), orderBy("createdAt", "desc"), limit(n)),
      (s) => setState({ posts: docsOf(s), ready: true, error: false }),
      () => setState({ posts: [], ready: true, error: true }),
    );
  }, [clubId, n]);
  useEffect(() => {
    if (!firebaseConfigured || !clubId) return undefined;
    // Same field in the filter and the order, so no composite index.
    return onSnapshot(
      query(posts(clubId), where("createdAt", ">", now - PIN_MS), orderBy("createdAt", "desc"), limit(50)),
      (s) => setPinned(docsOf(s).filter((p) => isPinned(p, now))),
      () => setPinned([]),
    );
  }, [clubId, now]);

  return { ...state, pinned, now, hasMore: state.posts.length === n, loadMore: () => setN((x) => x + PAGE) };
}

// A post's replies, oldest first, only while they are open (postId null = closed).
export function useReplies(clubId, postId) {
  const replies = useDocs(postId ? ["clubs", clubId, "announcements", postId, "replies"] : null);
  return useMemo(() => [...replies].sort((a, b) => a.createdAt - b.createdAt), [replies]);
}

// A post's photo, read once per post (a post never changes its photo). "" = none or not loaded yet.
const photos = new Map();
const photoListeners = new Set();
const subscribePhotos = (fn) => { photoListeners.add(fn); return () => photoListeners.delete(fn); };
export function usePostPhoto(clubId, postId) {
  const value = useSyncExternalStore(subscribePhotos, () => photos.get(postId));
  useEffect(() => {
    if (!postId || !firebaseConfigured || photos.has(postId)) return;
    photos.set(postId, null);
    const done = (image) => { photos.set(postId, image || ""); photoListeners.forEach((fn) => fn()); };
    getDoc(doc(postRef(db, clubId, postId), "photo", "main")).then((s) => done(s.data()?.image), () => done(""));
  }, [clubId, postId]);
  return value || "";
}

export function useFeedActions({ clubId, uid }) {
  const memberName = async () => {
    const ref = doc(db, "clubs", clubId, "members", uid);
    const member = await getDocFromCache(ref).catch(() => getDoc(ref));
    const data = member.data();
    if (!data?.name) throw new Error("Couldn't find your club profile. Reload and try again.");
    return data;
  };

  const publish = async ({ text, announcement = false, file = null }) => {
    const body = cleanText(text, POST_MAX);
    const image = file
      ? await compressImage(file, { steps: PHOTO_STEPS.post, max: PHOTO_LIMITS.post, message: "Choose a picture.", tooLarge: "That picture is too large. Try another one." })
      : null;
    const me = await memberName();
    const ref = doc(posts(clubId));
    const batch = writeBatch(db);
    batch.set(ref, {
      authorId: uid, authorName: me.name, authorRole: me.role, text: body, createdAt: Date.now(),
      announcement: !!announcement, hasPhoto: !!image, hearts: [], replyCount: 0,
    });
    if (image) {
      batch.set(doc(ref, "photo", "main"), { image });
      photos.set(ref.id, image);
    }
    await batch.commit();
  };

  const toggleHeart = (post) =>
    updateDoc(postRef(db, clubId, post.id), { hearts: hasHeart(post, uid) ? arrayRemove(uid) : arrayUnion(uid) });

  const reply = async (post, text) => {
    const body = cleanText(text, REPLY_MAX);
    const me = await memberName();
    const ref = doc(collection(postRef(db, clubId, post.id), "replies"));
    const batch = writeBatch(db);
    batch.set(ref, { authorId: uid, authorName: me.name, text: body, createdAt: Date.now() });
    batch.update(postRef(db, clubId, post.id), { replyCount: increment(1), lastReplyId: ref.id });
    await batch.commit();
  };

  const removeReply = (post, replyId) => {
    const batch = writeBatch(db);
    batch.delete(doc(postRef(db, clubId, post.id), "replies", replyId));
    batch.update(postRef(db, clubId, post.id), { replyCount: increment(-1), lastReplyId: replyId });
    return batch.commit();
  };

  const removePost = (post) => deletePostBatch(db, clubId, post.id);

  return { publish, toggleHeart, reply, removeReply, removePost };
}
