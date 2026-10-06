import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

const App = lazy(() => import("./App"));
const LiveBoard = lazy(() => import("./LiveBoard"));

const OpenPlay = lazy(() => import("./OpenPlay"));

const path = window.location.pathname.replace(/\/+$/, "");
const Page = path === "/live" ? LiveBoard : path === "/open-play" ? OpenPlay : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading"><span className="spinner" />Loading…</div>}>
      <Page />
    </Suspense>
  </React.StrictMode>
);
