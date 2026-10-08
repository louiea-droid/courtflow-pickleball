// A "base" is the Firestore path (an array) of the document that acts as one queue
// session. Its subcollections are players, courts, matchLog and costs. A quick session is
// sessions/{uid}; a game is clubs/{clubId}/events/{eventId}. Null while the ids aren't known.
export const sessionBase = (uid) => (uid ? ["sessions", uid] : null);
export const eventBase = (clubId, eventId) => (clubId && eventId ? ["clubs", clubId, "events", eventId] : null);
