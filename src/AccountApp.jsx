import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useAccount } from "./hooks/useAccount";
import { useRoute } from "./hooks/useRoute";
import { applyDisplayPrefs } from "./utils/format";
import { applyTheme } from "./utils/theme";
import { DEFAULT_COST, DEFAULT_DISPLAY, DEFAULT_LIVE, DEFAULT_RULES } from "./data/constants";
import AccountLogin from "./components/AccountLogin";
import DeleteAccountDialog from "./components/DeleteAccountDialog";
import Settings from "./views/Settings";
import Toast from "./components/Toast";
import Hub from "./views/Hub";
import Host from "./views/Host";
import BookingModal from "./components/BookingModal";
import ShareModal from "./components/ShareModal";
import { useEvents, useEventRequests } from "./hooks/useEvents";
import { useEventActions } from "./hooks/useEventActions";
import { hasEndedIn } from "./utils/bookings";

export default function AccountApp() {
  const acct = useAccount();
  const { route, eventId, navigate } = useRoute();
  const [eventModal, setEventModal] = useState(null); // null | "new" | an event being edited
  const [showShare, setShowShare] = useState(false);
  const uid = acct.user?.uid;
  const { events, ready: eventsReady } = useEvents(uid);
  const fallbackZone = { ...DEFAULT_DISPLAY, ...acct.account?.display }.timeZone;
  // Listen for requests only on events still on the calendar (and the one open on screen).
  const watched = events.filter((e) => !hasEndedIn(e, fallbackZone) || e.id === eventId).map((e) => e.id);
  const requestsByEvent = useEventRequests(uid, watched);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const notify = (message, ms = 2200) => {
    clearTimeout(toastTimer.current);
    setToast({ message, action: null });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const dismissToast = () => { clearTimeout(toastTimer.current); setToast(null); };

  const display = { ...DEFAULT_DISPLAY, ...acct.account?.display };
  const rules = { ...DEFAULT_RULES, ...acct.account?.rules };
  const costDefaults = { ...DEFAULT_COST, ...acct.account?.costDefaults };
  const live = { ...DEFAULT_LIVE, ...acct.account?.live };
  const save = async (patch) => { await acct.updateAccount(patch); notify("Saved."); };
  const actions = useEventActions({
    uid, events, hostName: acct.account?.clubName || "", timeZone: display.timeZone, notify,
  });
  const latestPayInfo = [...events].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))[0]?.payInfo;
  const todayYmd = new Intl.DateTimeFormat("en-CA", { timeZone: display.timeZone }).format(new Date());

  // Success signs the user out (deleteUser). This shell stays mounted behind the
  // sign-in screen, so close the dialog or the next sign-in opens on it.
  const handleDelete = async (password) => {
    setDeleting(true);
    try {
      const err = await acct.deleteAccount(password);
      setDeleting(false);
      if (!err) setShowDelete(false);
      return err;
    } catch {
      setDeleting(false);
      return "Couldn't delete the account. Please try again.";
    }
  };

  applyDisplayPrefs(display);
  // Not before the account loads: defaults would flash Light over the cached theme.
  if (acct.status === "in") applyTheme(display);

  if (acct.status === "loading") {
    return <div className="loading"><span className="spinner" />Loading…</div>;
  }
  if (acct.status === "error") {
    return (
      <div className="loading">
        Couldn't load your account. Check your connection, then reload the page.
        <button className="outline" onClick={acct.signOutUser}><LogOut size={14} /> Sign out</button>
      </div>
    );
  }
  if (acct.status === "out") {
    return (
      <AccountLogin
        onSignIn={acct.signIn} onSignUp={acct.signUp} onGoogle={acct.signInGoogle} onReset={acct.resetPassword}
      />
    );
  }

  const go = (to) => (e) => { e.preventDefault(); navigate(to); };

  return (
    <div className="acct-shell">
      <header className="acct-bar">
        <a className="acct-brand" href="/" onClick={go("/")}>
          <img src="/images/courtflow.png" alt="" />
          <b>CourtFlow</b>
        </a>
        <nav aria-label="Account">
          <a href="/" className={route === "hub" ? "active" : ""} onClick={go("/")}>Home</a>
          <a href="/host" className={route === "host" || route === "event" ? "active" : ""} onClick={go("/host")}>Open play</a>
          <a href="/settings" className={route === "settings" ? "active" : ""} onClick={go("/settings")}>Settings</a>
        </nav>
        <button className="outline" onClick={acct.signOutUser}><LogOut size={14} /> Sign out</button>
      </header>
      <main className="acct-main">
        {route === "settings" ? (
          <Settings
            mode="account"
            session={{ location: acct.account.clubName, defaults: acct.account.defaults }}
            canChangePassword={acct.hasPassword}
            onRenameClub={(clubName) => save({ clubName })}
            onChangePassword={acct.changePassword}
            onDeleteAccount={() => setShowDelete(true)}
            onSetDefaults={(defaults) => save({ defaults })}
            rules={rules} costDefaults={costDefaults} live={live} display={display}
            onSetRules={(change) => save({ rules: { ...rules, ...change } })}
            onSetCostDefaults={(change) => save({ costDefaults: { ...costDefaults, ...change } })}
            onSetLive={(change) => save({ live: { ...live, ...change } })}
            onSetDisplay={(change) => save({ display: { ...display, ...change } })}
          />
        ) : route === "host" ? (
          <Host
            events={events} requestsByEvent={requestsByEvent} fallbackZone={display.timeZone}
            onNew={() => setEventModal("new")} onShare={() => setShowShare(true)} navigate={navigate}
          />
        ) : (
          <Hub clubName={acct.account.clubName} navigate={navigate} />
        )}
      </main>
      {showDelete && (
        <DeleteAccountDialog
          variant="account" clubName={acct.account.clubName} needsPassword={acct.hasPassword} loading={deleting}
          onCancel={() => setShowDelete(false)} onConfirm={handleDelete}
        />
      )}
      {eventModal && (
        <BookingModal
          booking={eventModal === "new" ? null : eventModal} today={todayYmd} lastPayInfo={latestPayInfo}
          close={() => setEventModal(null)}
          submit={async (data) => {
            const id = await actions.save(eventModal === "new" ? null : eventModal.id, data);
            setEventModal(null);
            if (eventModal === "new") navigate(`/event/${id}`);
          }}
        />
      )}
      {showShare && (
        <ShareModal
          url={`${window.location.origin}/open-play?host=${uid}`} close={() => setShowShare(false)}
          title="Share your booking page" openLabel="Open booking page" qr
          hint="Players scan the code or open the link to see your upcoming open play and ask to join. You confirm each request on its event page."
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
