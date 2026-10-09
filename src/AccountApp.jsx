import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useAccount } from "./hooks/useAccount";
import { useRoute } from "./hooks/useRoute";
import { useMyClubs } from "./hooks/useMyClubs";
import { useFriendships } from "./hooks/useFriends";
import { useInbox } from "./hooks/useChats";
import { useSessions } from "./hooks/useSessions";
import { friendBuckets } from "./utils/friends";
import { useClubActions } from "./hooks/useClubActions";
import { applyTheme } from "./utils/theme";
import AccountLogin from "./components/AccountLogin";
import AccountSidebar from "./components/AccountSidebar";
import DeleteAccountDialog from "./components/DeleteAccountDialog";
import Toast from "./components/Toast";
import Hub from "./views/Hub";
import MyClubs from "./views/MyClubs";
import Friends from "./views/Friends";
import Inbox from "./views/Inbox";
import FindSession from "./views/FindSession";
import CreateClub from "./views/CreateClub";
import FindClubs from "./views/FindClubs";
import Profile from "./views/Profile";
import ClubApp from "./ClubApp";

// Sign-in, the hub, creating a club, and the profile. Everything under /clubs/:id is ClubApp.
export default function AccountApp() {
  const acct = useAccount();
  const { route, clubId, eventId, chatId, navigate } = useRoute();
  const uid = acct.user?.uid;
  const name = acct.account?.name || acct.account?.clubName || "";
  const { clubs, ready: clubsReady } = useMyClubs(uid);
  const { friendships, ready: friendsReady } = useFriendships(uid);
  const inbox = useInbox(uid, clubs);
  // One Find session query shared by Home and the Find session page; off on every other screen.
  const sessions = useSessions(route === "hub" || route === "sessions");
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
  const clubActions = useClubActions({ uid, name, notify });

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

  // Not before the account loads: defaults would flash Light over the cached theme. Clubs apply their own colors inside ClubApp.
  if (acct.status === "in" && !clubId) applyTheme({ theme: acct.account.display?.theme || "light" });

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

  if (clubId && route.startsWith("club")) {
    return <ClubApp key={clubId} acct={acct} clubId={clubId} route={route} eventId={eventId} navigate={navigate} inbox={inbox} />;
  }

  const ownedNames = clubs.filter((c) => c.role === "owner").map((c) => c.clubName);

  return (
    <div className="acct-shell">
      <AccountSidebar
        active={{ "clubs-find": "find", clubs: "clubs", friends: "friends", inbox: "inbox", sessions: "sessions", hub: "hub" }[route] || null}
        name={name} email={acct.user?.email} onSignOut={acct.signOutUser} navigate={navigate} clubs={clubs}
        friendRequests={friendBuckets(friendships, uid).received.length} inboxUnread={inbox.unread}
      />
      <main className="acct-main">
        {route === "settings" ? (
          <Profile acct={acct} onDelete={() => setShowDelete(true)} />
        ) : route === "clubs-new" ? (
          <CreateClub onCreate={clubActions.createClub} navigate={navigate} />
        ) : route === "friends" ? (
          <Friends uid={uid} name={name} friendships={friendships} ready={friendsReady} notify={notify} navigate={navigate} />
        ) : route === "inbox" ? (
          <Inbox uid={uid} name={name} clubs={clubs} clubsReady={clubsReady} inbox={inbox} chatId={chatId} navigate={navigate} />
        ) : route === "sessions" ? (
          <FindSession clubs={clubs} sessions={sessions} navigate={navigate} />
        ) : route === "clubs" ? (
          <MyClubs clubs={clubs} ready={clubsReady} navigate={navigate} />
        ) : route === "clubs-find" ? (
          <FindClubs myClubs={clubs} navigate={navigate} />
        ) : (
          <Hub uid={uid} name={name} clubs={clubs} ready={clubsReady} friendships={friendships} inbox={inbox} sessions={sessions} navigate={navigate} />
        )}
      </main>
      {showDelete && (
        <DeleteAccountDialog
          variant="account" clubName={name} ownedClubs={ownedNames} needsPassword={acct.hasPassword} loading={deleting}
          onCancel={() => setShowDelete(false)} onConfirm={handleDelete}
        />
      )}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
