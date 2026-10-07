import { useState } from "react";
import Modal from "./Modal";
import { gamePickList } from "../utils/gameSession";

const PAID_TAG = { paid: "Paid", unpaid: "Unpaid", refunded: "Refunded" };

// "Proceed to game" (first start) and "Add players" (live) share this list. Nothing is
// ticked when it opens; the host ticks who is here. Ticked players join not checked in.
export default function GamePickModal({ event, players, close, submit }) {
  const rows = gamePickList(event, players);
  const live = event.status === "live";
  const [picked, setPicked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectable = rows.filter((r) => !r.inGame);
  const joined = rows.filter((r) => r.group === "joined");
  const waiting = rows.filter((r) => r.group === "waitlist");

  const toggle = (id) => setPicked((cur) => {
    const next = new Set(cur);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const choose = (test) => setPicked(new Set(selectable.filter(test).map((r) => r.id)));
  // A first start with nobody booked is allowed: walk-ins are added in the game.
  const canSubmit = !busy && (picked.size > 0 || (!live && !rows.length));

  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await submit([...picked]);
    } catch {
      setError("Couldn't start the game. Check your connection and try again.");
      setBusy(false);
    }
  };

  const row = (r) => (
    <label className={`pick-row ${r.inGame ? "in" : ""}`} key={r.id}>
      <input type="checkbox" checked={r.inGame || picked.has(r.id)} disabled={r.inGame} onChange={() => toggle(r.id)} />
      <b>{r.name}</b>
      <span className="pick-tags">
        {r.inGame ? <span className="pill">In the game</span> : (
          <>
            {r.group === "waitlist" && <span className="pill off">Waitlist #{r.waitNo}</span>}
            <span className={`pill ${r.paid === "paid" ? "" : "off"}`}>{PAID_TAG[r.paid]}</span>
          </>
        )}
      </span>
    </label>
  );

  return (
    <Modal title={live ? "Add players to the game" : "Proceed to game"} label={event.title} close={close}>
      <p className="pick-help">
        Tick the players who are here. They join the game not checked in; tap each in on the Queue tab as they arrive.
      </p>
      <div className="pick-tools">
        <button type="button" className="tiny outline" onClick={() => choose((r) => r.group === "joined")}>Select all joined</button>
        <button type="button" className="tiny outline" onClick={() => choose((r) => r.paid === "paid")}>Select all paid</button>
        <button type="button" className="tiny outline" onClick={() => setPicked(new Set())}>Clear</button>
      </div>
      {rows.length ? (
        <div className="pick-list" role="group" aria-label="Players">
          {joined.map(row)}
          {waiting.length > 0 && <div className="pick-head">Waitlist</div>}
          {waiting.map(row)}
        </div>
      ) : (
        <div className="empty">Nobody has booked yet. Start the game and add walk-ins there.</div>
      )}
      {error && <p className="op-error" role="alert">{error}</p>}
      <div className="modalactions">
        <button className="outline" onClick={close}>Cancel</button>
        <button className="primary" disabled={!canSubmit} onClick={go}>
          {live ? "Add to game" : "Start game"}{picked.size ? ` (${picked.size})` : ""}
        </button>
      </div>
    </Modal>
  );
}
