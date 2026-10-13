// Removing a court re-packs the survivors into contiguous court-1..court-N doc ids (keeping their data) so numbering
// never gets gaps that later break addCourt. A court's live score and its umpire's claim (courtClaims/{courtId}) belong to
// the match, so both move with it; the removed court's claim goes.
export function packCourts(courts, removedId, claims = []) {
  const remaining = courts.filter((c) => c.id !== removedId).sort((a, b) => a.courtNumber - b.courtNumber);
  const newId = new Map(remaining.map((c, i) => [c.id, `court-${i + 1}`]));
  const sets = remaining.map((c, i) => ({
    id: `court-${i + 1}`,
    data: {
      courtNumber: i + 1,
      start: c.start ?? Date.now(),
      teamA: c.teamA || [],
      teamB: c.teamB || [],
      ...(c.level ? { level: c.level } : {}),
      ...(c.score ? { score: c.score } : {}),
    },
  }));
  const claimSets = claims.filter((cl) => newId.has(cl.id)).map((cl) => ({ id: newId.get(cl.id), data: { uid: cl.uid, name: cl.name } }));
  const kept = new Set(claimSets.map((s) => s.id));
  return {
    sets,
    deletes: courts.map((c) => c.id).filter((id) => !sets.some((s) => s.id === id)),
    claimSets,
    claimDeletes: claims.filter((cl) => !kept.has(cl.id)).map((cl) => cl.id),
  };
}
