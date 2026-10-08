import { Suspense, lazy, useRef, useState } from "react";
import { ArrowLeft, LogOut } from "lucide-react";
import { useClubDoc } from "./hooks/useClubDoc";
import { useClubActions } from "./hooks/useClubActions";
import { useEvents, useEventRequests } from "./hooks/useEvents";
import { useEventActions } from "./hooks/useEventActions";
import { useEventPlayers } from "./hooks/useEventPlayers";
import { useGameActions } from "./hooks/useGameActions";
import { applyDisplayPrefs } from "./utils/format";
import { applyTheme } from "./utils/theme";
import { isOver } from "./utils/bookings";
import { clubPath } from "./utils/clubs";
import { DEFAULT_DISPLAY } from "./data/constants";
import ClubHome from "./views/ClubHome";
import ClubSettings from "./views/ClubSettings";
import Host from "./views/Host";
import EventPage from "./views/EventPage";
import BookingModal from "./components/BookingModal";
import ShareModal from "./components/ShareModal";
import GamePickModal from "./components/GamePickModal";
import Toast from "./components/Toast";

// The queue app only loads when a game opens.
const Game = lazy(() => import("./Game"));

const Loading = () => <div className="loading"><span className="spinner" />Loading…</div>;

// Shown in place of a screen the person's role doesn't allow (Review Focus 3): no controls at all.
function ManagersOnly({ base, navigate }) {
  return (
    <div className="panel">
      <div className="empty">This page is for the club's managers.</div>
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
  // The club's colors apply inside the club; persist: false keeps the person's own theme cached for the hub.
  if (ready) applyTheme(display, { persist: false });

  const toHub = (e) => { e.preventDefault(); navigate("/"); };
  const go = (to) => (e) => { e.preventDefault(); navigate(to); };

  if (info.status === "loading") return <Loading />;
  if (!ready) {
    return (
      <div className="loading">
        Club not found. It may have been deleted, or it is a private club you haven't joined.
        <a className="outline back-link" href="/" onClick={toHub}><ArrowLeft size={14} /> My clubs</a>
      </div>
    );
  }

  if (route === "club-game") {
    // Only managers run games. Everyone else sees the same message as the other manager screens.
    if (!canManage) {
      return (
        <div className="acct-shell"><main className="acct-main"><ManagersOnly base={base} navigate={navigate} /></main></div>
      );
    }
    return (
      <Suspense fallback={<Loading />}>
        <Game
          clubId={clubId} club={club} event={events.find((e) => e.id === eventId)} ready={eventsReady}
          base={base} navigate={navigate} endGame={endGame} onSetAttendeePaid={actions.setPaid}
        />
      </Suspense>
    );
  }

  const screen = () => {
    if (route === "club") {
      return <ClubHome club={club} role={role} canManage={canManage} events={events} fallbackZone={fallbackZone} base={base} navigate={navigate} />;
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

  const navClass = (...routes) => (routes.includes(route) ? "active" : "");

  return (
    <div className="acct-shell club-shell">
      <header className="acct-bar">
        <a className="acct-brand" href="/" onClick={toHub}>
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </a>
        <nav aria-label="Club">
          <a href={base} className={navClass("club")} onClick={go(base)}>{club.name}</a>
          {canManage && <a href={`${base}/host`} className={navClass("club-host", "club-event")} onClick={go(`${base}/host`)}>Open play</a>}
          {canManage && <a href={`${base}/settings`} className={navClass("club-settings")} onClick={go(`${base}/settings`)}>Settings</a>}
          <a href="/" onClick={toHub}>My clubs</a>
        </nav>
        <button className="outline" onClick={acct.signOutUser}><LogOut size={14} /> Sign out</button>
      </header>
      <main className="acct-main">{screen()}</main>
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
