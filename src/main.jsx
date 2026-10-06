import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import { routeOf } from "./utils/route";

const App = lazy(() => import("./App"));
const LiveBoard = lazy(() => import("./LiveBoard"));
const OpenPlay = lazy(() => import("./OpenPlay"));
const AccountApp = lazy(() => import("./AccountApp"));

// /club is the existing club app; the hub and settings live in AccountApp.
const pages = { live: LiveBoard, "open-play": OpenPlay, club: App };
const Page = pages[routeOf(window.location.pathname)] || AccountApp;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading"><span className="spinner" />Loading…</div>}>
      <Page />
    </Suspense>
  </React.StrictMode>
);
