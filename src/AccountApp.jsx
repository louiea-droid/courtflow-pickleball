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

export default function AccountApp() {
  const acct = useAccount();
  const { route, navigate } = useRoute();
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
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
