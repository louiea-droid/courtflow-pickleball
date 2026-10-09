import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, LayoutDashboard, MapPin, Megaphone, Play, Users } from "lucide-react";
import { useClubDoc } from "./hooks/useClubDoc";
import { useClubActions } from "./hooks/useClubActions";
import { useEvents, useEventRequests } from "./hooks/useEvents";
import { useEventActions } from "./hooks/useEventActions";
import { useSessionSync } from "./hooks/useSessionSync";
import { useEventPlayers } from "./hooks/useEventPlayers";
import { useGameActions } from "./hooks/useGameActions";
import { useJoinRequests, useMembers } from "./hooks/useMembership";
import { removeMyCopy, useMembershipActions } from "./hooks/useMembershipActions";
import { useMyClubs } from "./hooks/useMyClubs";
import { useFriendships } from "./hooks/useFriends";
import { useChatActions } from "./hooks/useChatActions";
import { useAnnouncementActions, useAnnouncements } from "./hooks/useAnnouncements";
import { friendBuckets } from "./utils/friends";
import { applyDisplayPrefs } from "./utils/format";
import { applyTheme } from "./utils/theme";
import { isOver } from "./utils/bookings";
import { uidBySeat } from "./utils/gameSession";
import { ROLE_LABEL, clubPath } from "./utils/clubs";
import { DEFAULT_DISPLAY, DEFAULT_RULES, RULE_DEFAULTS_VERSION } from "./data/constants";
import ClubHome from "./views/ClubHome";
import ClubMembers from "./views/ClubMembers";
import ClubSettings from "./views/ClubSettings";
import QueueView from "./views/QueueView";
import Host from "./views/Host";
import EventPage from "./views/EventPage";
import ClubAnnouncements from "./views/ClubAnnouncements";
import BookingModal from "./components/BookingModal";
import ShareModal from "./components/ShareModal";
import ClubHeaderActions from "./components/ClubHeaderActions";
import GamePickModal from "./components/GamePickModal";
import AccountSidebar from "./components/AccountSidebar";
import JoinPanel from "./components/JoinPanel";
import Toast from "./components/Toast";

// The queue app only loads when a game opens.
const Game = lazy(() => import("./Game"));

// Shown in place of a screen the person's role doesn't allow (Review Focus 3): no controls at all.
function Restricted({ text, base, navigate }) {
  return (
    <div className="panel notice">
      <p>{text}</p>
      <a className="outline back-link" href={base} onClick={(e) => { e.preventDefault(); navigate(base); }}>
        <ArrowLeft size={14} /> Back to the club
      </a>
    </div>
  );
}
const ManagersOnly = (props) => <Restricted text="This page is for the club's managers." {...props} />;
const MembersOnly = (props) => <Restricted text="This page is for the club's members." {...props} />;

// Everything under /clubs/:id. It loads the club and this person's role, applies the club's theme
// and time zone, and routes to the screens. Managers get the open play and settings screens.
export default function ClubApp({ acct, clubId, route, eventId, navigate, inbox, activeGame }) {
  const uid = acct.user.uid;
  const info = useClubDoc(uid, clubId);
  const { club, role, isMember, canManage, isOwner } = info;
  const ready = info.status === "ready";
  const base = clubPath(clubId);

  const [eventModal, setEventModal] = useState(null); // null | "new" | an event being edited
  const [showShare, setShowShare] = useState(false);
  const [gamePick, setGamePick] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const partnerRuleMigration = useRef("");
  const notify = (message, ms = 2200) => {
    clearTimeout(toastTimer.current);
    setToast({ message, action: null });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const dismissToast = () => { clearTimeout(toastTimer.current); setToast(null); };
  const display = { ...DEFAULT_DISPLAY, ...club?.display };
  const fallbackZone = display.timeZone;
  // Public clubs show open play to everyone, private ones to members only (no listener for anyone else).
  const canSee = ready && (club.visibility === "public" || isMember);
  const { events, fromServer: eventsReady } = useEvents(canSee ? clubId : null);
  const { requests: pendingRequests } = useJoinRequests(ready && canManage ? clubId : null);
  // The club's members, only while a manager runs a game: the add-player form can tie a player to one.
  const { members: clubMembers } = useMembers(ready && canManage && route === "club-game" ? clubId : null);
  const personName = acct.account?.name || acct.account?.clubName;
  const membership = useMembershipActions({ uid, name: personName, clubId, club });
  const params = new URLSearchParams(window.location.search);
  const managerCode = params.get("manager");
  const invite = managerCode || params.get("invite");
  const inviteRole = managerCode ? "manager" : "member";
  // A "My clubs" card for a club the person is not in (they were removed, or it was deleted) cleans itself
  // up, but only once the server has confirmed the club and the member record: from the cache, or while our
  // own join is still queued (offline, slow), "not a member" can be wrong and a real card would be deleted.
  // The short wait covers the moment right after joining, when the card can arrive before the record.
  const { clubs: myClubs } = useMyClubs(uid);
  const { friendships } = useFriendships(uid);
  const chatActions = useChatActions({ uid, name: personName });
  const { announcements, ready: announcementsReady, error: announcementsError } = useAnnouncements(ready && isMember ? clubId : null);
  const announcementActions = useAnnouncementActions({ clubId, uid });
  const hasCard = myClubs.some((c) => c.id === clubId);
  useEffect(() => {
    if (!info.confirmed || isMember || !hasCard) return undefined;
    const t = setTimeout(() => { removeMyCopy(uid, clubId).catch(() => {}); }, 2500);
    return () => clearTimeout(t);
  }, [info.confirmed, isMember, hasCard, uid, clubId]);
  // Listen for requests only on events still on the calendar (and the one open on screen), and only for managers.
  const watched = canManage ? events.filter((e) => !isOver(e, fallbackZone) || e.id === eventId).map((e) => e.id) : [];
  const requestsByEvent = useEventRequests(ready ? clubId : null, watched);
  const { players: gamePlayers, loaded: gameLoaded } = useEventPlayers(ready && canManage ? clubId : null, route === "club-event" ? eventId : null);

  const hostName = club?.name || "";
  useSessionSync({ clubId, club, events, canManage });
  const actions = useEventActions({ clubId, club, events, hostName, timeZone: display.timeZone, notify });
  const gameActions = useGameActions({ clubId, club, hostName, timeZone: display.timeZone, notify });
  const clubActions = useClubActions({ uid, name: acct.account?.name || acct.account?.clubName, notify });
  useEffect(() => {
    if (
      !ready || !canManage || club.ruleDefaultsVersion === RULE_DEFAULTS_VERSION
      || partnerRuleMigration.current === clubId
    ) return;
    partnerRuleMigration.current = clubId;
    clubActions.updateClub(clubId, {
      rules: { ...DEFAULT_RULES, ...club.rules, avoidRepeatPartners: true },
      ruleDefaultsVersion: RULE_DEFAULTS_VERSION,
    }).catch(() => notify("Couldn't enable repeat-partner avoidance for this club. Try again in Settings.", 4000));
  }, [ready, canManage, clubId, club?.rules?.avoidRepeatPartners]);
  const openEvent = events.find((e) => e.id === eventId);
  const latestPayInfo = [...events].filter((e) => !e.walkIn).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]?.payInfo;
  const todayYmd = new Intl.DateTimeFormat("en-CA", { timeZone: display.timeZone }).format(new Date());
  const publishAnnouncement = async (text) => {
    await announcementActions.publish(text);
    notify("Announcement posted.");
  };
  const removeAnnouncement = async (id) => {
    await announcementActions.remove(id);
    notify("Announcement deleted.");
  };

  const playNow = async () => {
    try {
      navigate(`${base}/event/${await gameActions.playNow()}/game`);
    } catch {
      notify("Couldn't start a game. Check your connection and try again.", 4000);
    }
  };
  const endGame = async (id) => {
    navigate(`${base}/event/${id}`);
    try {
      await gameActions.endGame(id);
    } catch {
      notify("Couldn't end the game. Try again from the event page.", 4000);
    }
  };
  const reopenGame = async (id) => {
    try {
      await gameActions.reopenGame(id);
    } catch {
      notify("Couldn't reopen the game. Check your connection and try again.", 4000);
    }
  };

  applyDisplayPrefs(display);
  // Light or dark is always the person's own choice (Profile); the club only brings its accent and team
  // colors. persist: false keeps the person's cached theme for the hub.
  const personalTheme = acct.account?.display?.theme || "light";
  if (ready) applyTheme({ ...display, theme: personalTheme }, { persist: false, global: true });

  const toHub = (e) => { e.preventDefault(); navigate("/"); };

  // The same bar stays on screen while the club loads or when it can't be opened, so going from the hub
  // into a club never blanks the page.
  const sidebar = (sideClub, headerAction = null) => (
    <AccountSidebar
      active={null} name={acct.account?.name || acct.account?.clubName} email={acct.user?.email}
      onSignOut={acct.signOutUser} navigate={navigate} clubs={myClubs} club={sideClub}
      friendRequests={friendBuckets(friendships, uid).received.length} inboxUnread={inbox.unread}
      headerAction={headerAction}
    />
  );
  const inShell = (content) => <div className="acct-shell">{sidebar(null)}<main className="acct-main">{content}</main></div>;

  if (info.status === "loading") return inShell(<p className="hub-empty">Loading club…</p>);
  if (!ready) {
    return inShell(
      <div className="panel notice">
        <p>Club not found. It may have been deleted, or it is a private club you haven't joined.</p>
        <a className="outline back-link" href="/" onClick={toHub}><ArrowLeft size={14} /> My clubs</a>
      </div>,
    );
  }

  if (route === "club-game") {
    // Only managers run games. Everyone else sees the same message as the other manager screens.
    if (!canManage) return inShell(<ManagersOnly base={base} navigate={navigate} />);
    return (
      <Suspense fallback={inShell(<p className="hub-empty">Loading game…</p>)}>
        <Game
          clubId={clubId} club={{ ...club, display: { ...club.display, theme: personalTheme } }} event={events.find((e) => e.id === eventId)} ready={eventsReady}
          base={base} navigate={navigate} endGame={endGame} onSetAttendeePaid={actions.setPaid}
          memberChoices={clubMembers.map((m) => ({ id: m.id, name: m.name }))}
        />
      </Suspense>
    );
  }

  const screen = () => {
    if (route === "club") {
      return (
        <>
          {!isMember && (
            <JoinPanel
              uid={uid} clubId={clubId} club={club} invite={invite} inviteRole={inviteRole} actions={membership} notify={notify}
              onJoined={() => navigate(base)}
            />
          )}
          {canSee && (
            <ClubHome
              canManage={canManage} isMember={isMember} events={events} fallbackZone={fallbackZone} base={base} navigate={navigate}
              onNew={() => setEventModal("new")} announcements={announcements} announcementsReady={announcementsReady}
              announcementsError={announcementsError} onViewAnnouncements={() => navigate(`${base}/announcements`)}
            />
          )}
        </>
      );
    }
    if (route === "club-members") {
      if (!isMember) return <MembersOnly base={base} navigate={navigate} />;
      return (
        <ClubMembers
          clubId={clubId} club={club} uid={uid} canManage={canManage} isOwner={isOwner}
          requests={pendingRequests} actions={membership} navigate={navigate} notify={notify} chatActions={chatActions}
        />
      );
    }
    if (route === "club-announcements") {
      if (!isMember) return <MembersOnly base={base} navigate={navigate} />;
      return <ClubAnnouncements announcements={announcements} ready={announcementsReady} error={announcementsError} canManage={canManage} onPublish={publishAnnouncement} onRemove={removeAnnouncement} />;
    }
    if (route === "club-queue") {
      if (!isMember) return <MembersOnly base={base} navigate={navigate} />;
      return <QueueView clubId={clubId} base={base} eventId={eventId} uid={uid} navigate={navigate} />;
    }
    if (!canManage) return <ManagersOnly base={base} navigate={navigate} />;
    if (route === "club-host") {
      return (
        <Host
          events={events} requestsByEvent={requestsByEvent} fallbackZone={fallbackZone} base={base} navigate={navigate}
        />
      );
    }
    if (route === "club-event") {
      return (
        <EventPage
          event={openEvent} requests={requestsByEvent[eventId] || []} actions={actions} ready={eventsReady}
          gamePlayers={gamePlayers} gameLoaded={gameLoaded} base={base} navigate={navigate}
          onPickPlayers={() => setGamePick(true)} onOpenGame={() => navigate(`${base}/event/${eventId}/game`)}
          onReopen={() => reopenGame(eventId)} onEdit={setEventModal} onShare={() => setShowShare(true)}
        />
      );
    }
    return (
      <ClubSettings
        club={club} isOwner={isOwner} notify={notify}
        onUpdate={(patch) => clubActions.updateClub(clubId, patch)}
        onDelete={async () => { await clubActions.deleteClub(clubId); navigate("/"); }}
      />
    );
  };

  // Club destinations live under the club name in the page header; the sidebar remains the club switcher.
  const navTab = (to, label, Icon, routes, extra) => ({ to, label, Icon, current: routes.includes(route), ...extra });
  const clubTabs = !isMember ? [] : [
    navTab(base, "Overview", LayoutDashboard, ["club"]),
    ...(canManage ? [navTab(`${base}/host`, "Open play", CalendarDays, ["club-host", "club-event", "club-game"])] : []),
    navTab(`${base}/members`, "Members", Users, ["club-members"], canManage && pendingRequests.length > 0 ? { badge: pendingRequests.length, badgeText: "join requests waiting" } : {}),
    navTab(`${base}/announcements`, "Announcements", Megaphone, ["club-announcements"]),
  ];
  const sideClub = { id: clubId, name: club.name, current: route === "club" };
  const gamePath = activeGame?.gamePath || (route === "club-event" && openEvent?.status === "live"
    ? `${base}/event/${eventId}/game`
    : null);
  const gameShortcut = gamePath ? (
    <a
      className="acct-header-game"
      href={gamePath}
      aria-label="Back to game"
      title="Back to game"
      onClick={(e) => { e.preventDefault(); navigate(gamePath); }}
    >
      <Play size={15} fill="currentColor" aria-hidden="true" />
      <span>Back to game</span>
    </a>
  ) : null;

  return (
    <div className="acct-shell">
      {sidebar(sideClub, gameShortcut)}
      <main className="acct-main">
        <section className={`club-head${isMember ? "" : " solo"}`}>
          <div className="club-head-top">
            {/* One h1 per page: the club name on the overview, the page title on the other screens. */}
            {route === "club" ? <h1>{club.name}</h1> : <p className="club-name">{club.name}</p>}
            <div className="club-meta">
              {ROLE_LABEL[role] && <span className="pill">{ROLE_LABEL[role]}</span>}
              <span className="pill off">{club.visibility === "public" ? "Public club" : "Private club"}</span>
            </div>
            {isMember && (
              <ClubHeaderActions
                clubId={clubId} canManage={canManage}
                actions={membership} navigate={navigate} notify={notify}
                onStartNew={() => setEventModal("new")} onPlayNow={playNow} onShareBookingPage={() => setShowShare(true)}
              />
            )}
          </div>
          {clubTabs.length > 0 && (
            <nav className="club-page-nav" aria-label={`${club.name} navigation`}>
              {clubTabs.map((t) => (
                <a
                  key={t.to}
                  className="club-page-nav-link"
                  href={t.to}
                  aria-current={t.current ? "page" : undefined}
                  onClick={(e) => {
                    if (t.onClick) t.onClick(e);
                    else { e.preventDefault(); navigate(t.to); }
                  }}
                >
                  <t.Icon size={16} />
                  <span>{t.label}</span>
                  {t.badge > 0 && (
                    <>
                      <span className="count-badge">{t.badge}</span>
                      <span className="sr-only">{t.badgeText}</span>
                    </>
                  )}
                </a>
              ))}
            </nav>
          )}
          {route === "club" && club.location && <p className="club-location"><MapPin size={13} /> {club.location}</p>}
          {route === "club" && club.description && <p className="club-about">{club.description}</p>}
        </section>
        {screen()}
      </main>
      {eventModal && (
        <BookingModal
          booking={eventModal === "new" ? null : eventModal} today={todayYmd} lastPayInfo={latestPayInfo}
          close={() => setEventModal(null)}
          submit={async (data) => {
            const id = await actions.save(eventModal === "new" ? null : eventModal.id, data);
            setEventModal(null);
            if (eventModal === "new") navigate(`${base}/event/${id}`);
          }}
        />
      )}
      {showShare && (
        <ShareModal
          url={`${window.location.origin}/open-play?club=${clubId}`} close={() => setShowShare(false)}
          title="Share your booking page" openLabel="Open booking page" qr
          hint={club.visibility === "public"
            ? "Players scan the code or open the link to see your upcoming open play and ask to join. You confirm each request on its event page."
            : "This club is private, so only signed-in members can book. Make the club public in Settings to let anyone book."}
        />
      )}
      {gamePick && openEvent && (
        <GamePickModal
          event={openEvent} players={gamePlayers} close={() => setGamePick(false)}
          submit={async (ids) => {
            const started = await gameActions.startGame(openEvent, ids, uidBySeat(requestsByEvent[openEvent.id]));
            setGamePick(false);
            if (started) navigate(`${base}/event/${openEvent.id}/game`);
          }}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
