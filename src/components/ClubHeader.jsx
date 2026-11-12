import { useState } from "react";
import { Camera, Globe, Lock, MapPin, Pencil, Users } from "lucide-react";
import ClubBadge from "./ClubBadge";
import ClubShareMenu from "./ClubShareMenu";
import EditClubModal from "./EditClubModal";
import Wave from "./Wave";
import { useClubMedia } from "../hooks/useClubMedia";
import { useMembers } from "../hooks/useMembership";
import { ROLE_LABEL, badgeColor } from "../utils/clubs";
import { photoUrl } from "../utils/clubPhoto";

// Every club screen's header: the cover with the club photo over its corner, the name, one plain meta line, Share and (managers)
// Edit club, then the tabs.
export default function ClubHeader({
  clubId, club, role, isMember, canManage, isOwner, route, tabs, membership, clubActions, notify, onShareBooking,
}) {
  const media = useClubMedia(clubId);
  const cover = photoUrl(media.cover) ? media.cover : null;
  const photo = photoUrl(media.photo) ? media.photo : null;
  // ponytail: listens to the whole member list for one number; a count query if clubs grow into the thousands.
  const { members, ready: membersReady } = useMembers(isMember ? clubId : null);
  const [editing, setEditing] = useState(false);
  const isPublic = club.visibility === "public";
  const openEdit = () => setEditing(true);

  return (
    <section className={`club-head club-head-v2${isMember ? "" : " solo"}`}>
      <div className={`club-cover${cover ? " has-photo" : ""}`}
        style={cover ? { backgroundImage: photoUrl(cover) } : { "--club": badgeColor(clubId) }}>
        {!cover && <Wave className="club-cover-wave" />}
        {canManage && <button className="glass-btn club-cover-edit" onClick={openEdit}><Camera size={15} /> Change cover</button>}
      </div>
      <div className="club-head-body">
        <span className="club-head-photo-wrap">
          <ClubBadge className="club-head-photo" id={clubId} name={club.name} photo={photo || club.photo || ""} />
          {canManage && (
            <button className="club-photo-edit" onClick={openEdit} aria-label="Change club photo"><Camera size={14} /></button>
          )}
        </span>
        <div className="club-head-title">
          {/* One h1 per page: the club name on the overview, the page title on the other screens. */}
          {route === "club" ? <h1>{club.name}</h1> : <p className="club-name">{club.name}</p>}
          <div className="club-meta-line">
            {ROLE_LABEL[role] && <span className={`club-role ${role === "member" ? "soft" : ""}`}>{ROLE_LABEL[role]}</span>}
            <span>{isPublic ? <Globe size={14} /> : <Lock size={14} />} {isPublic ? "Public club" : "Private club"}</span>
            {club.location && <span><MapPin size={14} /> {club.location}</span>}
            {isMember && membersReady && <span><Users size={14} /> {members.length} member{members.length === 1 ? "" : "s"}</span>}
          </div>
        </div>
        {isMember && (
          <div className="club-head-actions">
            <ClubShareMenu clubId={clubId} clubName={club.name} isPublic={isPublic} canManage={canManage}
              actions={membership} notify={notify} onShareBooking={onShareBooking} />
            {canManage && <button className="outline" onClick={openEdit}><Pencil size={15} /> Edit club</button>}
          </div>
        )}
      </div>
      {tabs}
      {route === "club" && club.description && <p className="club-about">{club.description}</p>}
      {editing && (
        <EditClubModal
          clubId={clubId} club={club} isOwner={isOwner} cover={cover} photo={photo} notify={notify}
          onClose={() => setEditing(false)}
          onSaveProfile={async (patch) => { await clubActions.updateClub(clubId, patch); notify("Saved."); }}
          setClubPhoto={clubActions.setClubPhoto} setClubCover={clubActions.setClubCover}
        />
      )}
    </section>
  );
}
