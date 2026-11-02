import React, { Suspense, lazy, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./clubs.css";
import { routeOf } from "./utils/route";
import { isAccountUser, signedInHint } from "./utils/account";
import ErrorBoundary from "./ErrorBoundary";

const QuickSession = lazy(() => import("./QuickSession"));
const LiveBoard = lazy(() => import("./LiveBoard"));
const OpenPlay = lazy(() => import("./OpenPlay"));
const Umpire = lazy(() => import("./Umpire"));
const loadAccountApp = () => import("./AccountApp");
const AccountApp = lazy(loadAccountApp);
const Landing = lazy(() => import("./landing/Landing"));

// A visit to "/" by someone not signed in on this device (signedInHint) is the landing page, shown without waiting
// for Firebase: the app loads behind it, and a session found there (signed in before the hint existed) still opens
// the app. Any other path, or a navigation off the landing page, is AccountApp as before.
function Front() {
  const atRoot = () => (window.location.pathname.replace(/\/+$/, "") || "/") === "/";
  const [app, setApp] = useState(() => signedInHint() || !atRoot());
  useEffect(() => {
    if (app) return;
    let stop = () => {};
    let live = true;
    loadAccountApp(); // so Sign in / Get started open at once
    Promise.all([import("./firebase"), import("firebase/auth")]).then(([{ auth }, { onAuthStateChanged }]) => {
      if (live) stop = onAuthStateChanged(auth, (u) => { if (isAccountUser(u)) setApp(true); });
    });
    const onPop = () => { if (!atRoot()) setApp(true); };
    window.addEventListener("popstate", onPop);
    return () => { live = false; stop(); window.removeEventListener("popstate", onPop); };
  }, [app]);
  if (app) return <AccountApp />;
  return <Landing navigate={(to) => { window.history.pushState({}, "", to); setApp(true); }} />;
}

// /club is the quick session (no login); the hub, profile and club screens live in AccountApp.
const pages = { live: LiveBoard, "open-play": OpenPlay, quick: QuickSession, umpire: Umpire };
const Page = pages[routeOf(window.location.pathname)] || Front;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="loading"><span className="spinner" />Loading…</div>}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
