import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

const App = lazy(() => import("./App"));
const LiveBoard = lazy(() => import("./LiveBoard"));

const isLiveBoard = window.location.pathname.replace(/\/+$/, "") === "/live";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={<div className="loading"><span className="spinner" />Loading…</div>}>
      {isLiveBoard ? <LiveBoard /> : <App />}
    </Suspense>
  </React.StrictMode>
);
