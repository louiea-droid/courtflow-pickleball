import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { joinRequestDoc, memberRecord, membershipCopy, newInviteCode } from "../utils/clubs";
import { leaveClub } from "../utils/accountData";

// Removes this person's own "My clubs" card (a stale one: they were removed, or the club is gone).
export const removeMyCopy = (uid, clubId) => deleteDoc(doc(db, "accounts", uid, "memberships", clubId));

// Every write for joining, leaving and managing members. Each one rejects on failure; the screens turn
// that into a message. `name` is the signed-in person's name; `club` is the open club's document.
export function useMembershipActions({ uid, name, clubId, club }) {
  const requestRef = (id) => doc(db, "clubs", clubId, "joinRequests", id);
  const memberRef = (id) => doc(db, "clubs", clubId, "members", id);
  const cardRef = (id) => doc(db, "accounts", id, "memberships", clubId);

  const requestToJoin = (message) => setDoc(requestRef(uid), joinRequestDoc(name, message, Date.now()));
  // Withdraw a pending request, or dismiss a declined one.
  const cancelRequest = () => deleteDoc(requestRef(uid));

  // The invite code travels on the new member record; the rules compare it to the club's current code
  // (the member link for role "member", the owner's manager link for role "manager").
  const joinWithInvite = async (code, role = "member") => {
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(memberRef(uid), memberRecord(name, now, code, role));
    batch.set(cardRef(uid), membershipCopy(club, role, now));
    batch.delete(requestRef(uid)); // an earlier request of theirs is answered by joining
    await batch.commit();
  };

  // Approve: the member record, their "My clubs" card and the request go in one batch. If they already
  // joined another way (an invite link) the batch is refused; then just clear the request. If the request is
  // gone (they withdrew it) there is nothing to approve: the error says so.
  const approve = async (request) => {
    const now = Date.now();
    try {
      const batch = writeBatch(db);
      batch.set(memberRef(request.id), memberRecord(request.name, now));
      batch.set(cardRef(request.id), membershipCopy(club, "member", now));
      batch.delete(requestRef(request.id));
      await batch.commit();
    } catch (err) {
      const [member, pending] = await Promise.all([getDoc(memberRef(request.id)), getDoc(requestRef(request.id))]);
      if (member.exists()) return deleteDoc(requestRef(request.id));
      throw pending.exists() ? err : Object.assign(new Error("withdrawn"), { code: "withdrawn" });
    }
  };
  const decline = (request) => updateDoc(requestRef(request.id), { status: "declined" });

  const leave = () => leaveClub(db, clubId, uid);

  const removeMember = async (member) => {
    const batch = writeBatch(db);
    batch.delete(memberRef(member.id));
    batch.delete(cardRef(member.id));
    await batch.commit();
  };

  // The owner makes a member a manager or back: the member record and the person's card change together.
  const setRole = async (member, role) => {
    const batch = writeBatch(db);
    batch.update(memberRef(member.id), { role });
    batch.update(cardRef(member.id), { role });
    await batch.commit();
  };

  // Creates an invite link, or replaces it (every old link stops working). Resolves to the new code.
  // "manager" is the owner's link that makes managers; the default is the members' link.
  const saveInvite = async (role = "member") => {
    const code = newInviteCode();
    await setDoc(doc(db, "clubs", clubId, "private", role === "manager" ? "managerInvite" : "invite"), { code });
    return code;
  };

  return { requestToJoin, cancelRequest, joinWithInvite, approve, decline, leave, removeMember, setRole, saveInvite };
}
