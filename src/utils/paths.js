// A "base" is the Firestore path (an array) of the document that acts as one queue
// session. Its subcollections are players, courts, matchLog and costs. A quick session is
// sessions/{uid}; a game is accounts/{uid}/events/{eventId}. Null while the ids aren't known.
export const sessionBase = (uid) => (uid ? ["sessions", uid] : null);
export const eventBase = (uid, eventId) => (uid && eventId ? ["accounts", uid, "events", eventId] : null);
