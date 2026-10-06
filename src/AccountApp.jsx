import { useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { useAccount } from "./hooks/useAccount";
import { useRoute } from "./hooks/useRoute";
import { applyDisplayPrefs } from "./utils/format";
import { applyTheme } from "./utils/theme";
import { DEFAULT_DISPLAY } from "./data/constants";
import AccountLogin from "./components/AccountLogin";
import Toast from "./components/Toast";
import Hub from "./views/Hub";

export default function AccountApp() {
  const acct = useAccount();
  const { route, navigate } = useRoute();
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = (message, ms = 2200) => {
    clearTimeout(toastTimer.current);
    setToast({ message, action: null });
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };
  const dismissToast = () => { clearTimeout(toastTimer.current); setToast(null); };

  const display = { ...DEFAULT_DISPLAY, ...acct.account?.display };
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
        {route === "settings"
          ? <p>Settings arrive in the next task.</p>
          : <Hub clubName={acct.account.clubName} navigate={navigate} />}
      </main>
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
