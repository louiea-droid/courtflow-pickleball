import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import LiveBoard from "./LiveBoard";
import "./styles.css";

const isLiveBoard = window.location.pathname.replace(/\/+$/, "") === "/live";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isLiveBoard ? <LiveBoard /> : <App />}
  </React.StrictMode>
);
