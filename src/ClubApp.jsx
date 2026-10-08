import { Suspense, lazy, useRef, useState } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { useClubDoc } from "./hooks/useClubDoc";
import { useClubActions } from "./hooks/useClubActions";
import { useEvents, useEventRequests } from "./hooks/useEvents";
import { useEventActions } from "./hooks/useEventActions";
import { useEventPlayers } from "./hooks/useEventPlayers";
import { useGameActions } from "./hooks/useGameActions";
import { applyDisplayPrefs } from "./utils/format";
import { applyTheme } from "./utils/theme";
import { isOver } from "./utils/bookings";
import { ROLE_LABEL, clubPath } from "./utils/clubs";
import { DEFAULT_DISPLAY } from "./data/constants";
import ClubHome from "./views/ClubHome";
import ClubSettings from "./views/ClubSettings";
import Host from "./views/Host";
import EventPage from "./views/EventPage";
import BookingModal from "./components/BookingModal";
import ShareModal from "./components/ShareModal";
import GamePickModal from "./components/GamePickModal";
import AccountBar from "./components/AccountBar";
import Toast from "./components/Toast";

// The queue app only loads when a game opens.
const Game = lazy(() => import("./Game"));

// Shown in place of a screen the person's role doesn't allow (Review Focus 3): no controls at all.
function ManagersOnly({ base, navigate }) {
  return (
    <div className="panel notice">
      <p>This page is for the club's managers.</p>
      <a className="outline back-link" href={base} onClick={(e) => { e.preventDefault(); navigate(base); }}>
        <ArrowLeft size={14} /> Back to the club
      </a>
    </div>
  );
}

// Everything under /clubs/:id. It loads the club and this person's role, applies the club's theme
// and time zone, and routes to the screens. Managers get the open play and settings screens.
export default function ClubApp({ acct, clubId, route, eventId, navigate }) {
  const uid = acct.user.uid;
  const info = useClubDoc(uid, clubId);
  const { club, role, canManage, isOwner } = info;
  const ready = info.status === "ready";
  const base = clubPath(clubId);

  const [eventModal, setEventModal] = useState(null); // null | "new" | an event being edited
  const [showShare, setShowShare] = useState(false);
  const [gamePick, setGamePick] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = (message, ms = 2200) => {
    clearTimeout(toastTimer.current);
    setToast({ message, action: null });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const dismissToast = () => { clearTimeout(toastTimer.current); setToast(null); };

  const display = { ...DEFAULT_DISPLAY, ...club?.display };
  const fallbackZone = display.timeZone;
  const { events, fromServer: eventsReady } = useEvents(ready ? clubId : null);
  // Listen for requests only on events still on the calendar (and the one open on screen), and only for managers.
  const watched = canManage ? events.filter((e) => !isOver(e, fallbackZone) || e.id === eventId).map((e) => e.id) : [];
  const requestsByEvent = useEventRequests(ready ? clubId : null, watched);
  const { players: gamePlayers, loaded: gameLoaded } = useEventPlayers(ready && canManage ? clubId : null, route === "club-event" ? eventId : null);

  const hostName = club?.name || "";
  const actions = useEventActions({ clubId, events, hostName, timeZone: display.timeZone, notify });
  const gameActions = useGameActions({ clubId, club, hostName, timeZone: display.timeZone, notify });
  const clubActions = useClubActions({ uid, name: acct.account?.name || acct.account?.clubName, notify });
  const openEvent = events.find((e) => e.id === eventId);
  const latestPayInfo = [...events].filter((e) => !e.walkIn).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]?.payInfo;
  const todayYmd = new Intl.DateTimeFormat("en-CA", { timeZone: display.timeZone }).format(new Date());

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
  if (ready) applyTheme({ ...display, theme: personalTheme }, { persist: false });

  const toHub = (e) => { e.preventDefault(); navigate("/"); };
  const go = (to) => (e) => { e.preventDefault(); navigate(to); };

  // The same bar stays on screen while the club loads or when it can't be opened, so going from the hub
  // into a club never blanks the page.
  const bar = (
    <AccountBar
      active={false} name={acct.account?.name || acct.account?.clubName} email={acct.user?.email}
      onSignOut={acct.signOutUser} navigate={navigate}
    />
  );
  const inShell = (content) => <div className="acct-shell">{bar}<main className="acct-main">{content}</main></div>;

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
        />
      </Suspense>
    );
  }

  const screen = () => {
    if (route === "club") {
      return <ClubHome canManage={canManage} events={events} fallbackZone={fallbackZone} base={base} navigate={navigate} onNew={() => setEventModal("new")} />;
    }
    if (!canManage) return <ManagersOnly base={base} navigate={navigate} />;
    if (route === "club-host") {
      return (
        <Host
          events={events} requestsByEvent={requestsByEvent} fallbackZone={fallbackZone} base={base} navigate={navigate}
          onNew={() => setEventModal("new")} onPlayNow={playNow} onShare={() => setShowShare(true)}
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

  // One tab per club screen; the event page keeps "Open play" active.
  const tab = (to, label, ...routes) => (
    <a href={to} aria-current={routes.includes(route) ? "page" : undefined} onClick={go(to)}>{label}</a>
  );

  return (
    <div className="acct-shell">
      {bar}
      <main className="acct-main">
        <section className={`club-head${canManage ? "" : " solo"}`}>
          <div className="club-head-top">
            {/* One h1 per page: the club name on the overview, the page title on the other screens. */}
            {route === "club" ? <h1>{club.name}</h1> : <p className="club-name">{club.name}</p>}
            <div className="club-meta">
              {ROLE_LABEL[role] && <span className="pill">{ROLE_LABEL[role]}</span>}
              <span className="pill off">{club.visibility === "public" ? "Public club" : "Private club"}</span>
            </div>
          </div>
          {route === "club" && club.location && <p className="club-location"><MapPin size={13} /> {club.location}</p>}
          {route === "club" && club.description && <p className="club-about">{club.description}</p>}
        </section>
        {canManage && (
          <nav className="club-tabs" aria-label="Club">
            {tab(base, "Overview", "club")}
            {tab(`${base}/host`, "Open play", "club-host", "club-event")}
            {tab(`${base}/settings`, "Settings", "club-settings")}
          </nav>
        )}
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
            const started = await gameActions.startGame(openEvent, ids);
            setGamePick(false);
            if (started) navigate(`${base}/event/${openEvent.id}/game`);
          }}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
