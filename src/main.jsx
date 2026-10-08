import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import "./clubs.css";
import { routeOf } from "./utils/route";
import ErrorBoundary from "./ErrorBoundary";

const QuickSession = lazy(() => import("./QuickSession"));
const LiveBoard = lazy(() => import("./LiveBoard"));
const OpenPlay = lazy(() => import("./OpenPlay"));
const AccountApp = lazy(() => import("./AccountApp"));

// /club is the quick session (no login); the hub, profile and club screens live in AccountApp.
const pages = { live: LiveBoard, "open-play": OpenPlay, quick: QuickSession };
const Page = pages[routeOf(window.location.pathname)] || AccountApp;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="loading"><span className="spinner" />Loading…</div>}>
        <Page />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
