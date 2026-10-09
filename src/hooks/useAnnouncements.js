import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocFromCache, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";

const MAX_ANNOUNCEMENT_LENGTH = 2000;

export function useAnnouncements(clubId) {
  const [state, setState] = useState({ announcements: [], ready: false, error: false });

  useEffect(() => {
    setState({ announcements: [], ready: false, error: false });
    if (!firebaseConfigured || !clubId) return undefined;
    return onSnapshot(
      query(collection(db, "clubs", clubId, "announcements"), orderBy("createdAt", "desc"), limit(30)),
      (snapshot) => setState({
        announcements: snapshot.docs.map((announcement) => ({ id: announcement.id, ...announcement.data() })),
        ready: true,
        error: false,
      }),
      () => setState({ announcements: [], ready: true, error: true }),
    );
  }, [clubId]);

  return state;
}

export function useAnnouncementActions({ clubId, uid }) {
  const publish = async (text) => {
    const body = text.trim();
    if (!body) throw new Error("Write an announcement first.");
    if (body.length > MAX_ANNOUNCEMENT_LENGTH) throw new Error(`Announcements can be up to ${MAX_ANNOUNCEMENT_LENGTH} characters.`);

    const memberRef = doc(db, "clubs", clubId, "members", uid);
    const member = await getDocFromCache(memberRef).catch(() => getDoc(memberRef));
    const authorName = member.data()?.name;
    if (!authorName) throw new Error("Couldn't find your club profile. Reload and try again.");

    return addDoc(collection(db, "clubs", clubId, "announcements"), {
      authorId: uid,
      authorName,
      text: body,
      createdAt: Date.now(),
    });
  };

  const remove = (announcementId) => deleteDoc(doc(db, "clubs", clubId, "announcements", announcementId));

  return { publish, remove };
}
