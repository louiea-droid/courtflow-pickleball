import { useEffect, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Check, ImagePlus } from "lucide-react";
import { auth, db, firebaseConfigured } from "../firebase";
import { isAccountUser } from "../utils/account";
import { compressImage } from "../utils/receipt";
import { money } from "../utils/format";

// The player's own requests live on their device: the request id is the only key to
// read it back (rules allow a single get, never a list).
export const storeKey = (clubId) => `cf-openplay-${clubId}`;
export function loadMine(clubId) {
  try {
    // Entries from before seat ids (or from the old club booking page) can't be matched; drop them.
    return (JSON.parse(localStorage.getItem(storeKey(clubId))) || []).filter((m) => m.rid && m.seatId && m.eventId);
  } catch { return []; }
}
// Remembers a sent request on this device (the booking page shows its status from here).
export function saveMine(clubId, m, current = loadMine(clubId)) {
  const next = [...current, m];
  try { localStorage.setItem(storeKey(clubId), JSON.stringify(next)); } catch { /* private mode: status just won't persist */ }
  return next;
}

// The booking form: a name and how they pay. Paying online asks for a screenshot of the receipt, shrunk on the phone and
// saved on the private request for the host to check. No phone number: the host confirms on the event page.
export default function JoinForm({ event, clubId, autoOpen, onSent, onCancel, defaultName = "", fineprint = "The host confirms your spot. Check back on this page to see your status." }) {
  const [name, setName] = useState(defaultName);
  const [method, setMethod] = useState("cash");
  const [receipt, setReceipt] = useState("");
  const [receiptError, setReceiptError] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = useRef(null);
  const paid = event.fee > 0;
  const online = paid && method === "online";
  // A signed-in account (not a quick session or an old club login) links the booking to the person, so their
  // Home can show their place in the queue. Everyone else books exactly as before.
  const [uid, setUid] = useState(null);
  useEffect(() => (firebaseConfigured ? onAuthStateChanged(auth, (u) => setUid(isAccountUser(u) ? u.uid : null)) : undefined), []);

  const attach = async (picked) => {
    if (!picked) return;
    setReading(true);
    setReceiptError("");
    try { setReceipt(await compressImage(picked)); } catch (err) { setReceiptError(err.message); }
    setReading(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy || reading || (online && !receipt)) return;
    setBusy(true);
    setError("");
    const rid = crypto.randomUUID();
    const seatId = crypto.randomUUID();
    try {
      await setDoc(doc(db, "clubs", clubId, "events", event.id, "requests", rid), {
        name: name.trim(),
        method: paid ? method : "cash",
        ...(online ? { receipt } : {}),
        seatId, status: "pending", createdAt: Date.now(),
        ...(uid ? { uid } : {}),
      });
      onSent({ rid, seatId, eventId: event.id });
    } catch {
      setError("Couldn't send your request. Check your connection and your phone's clock, then try again.");
      setBusy(false);
    }
  };

  return (
    <form className="op-form" onSubmit={submit}>
      <div className="op-form-head">
        <h4>Save your spot</h4>
        <small>{paid ? `${money(event.fee)} per player` : "Free to join"}</small>
      </div>
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" required autoFocus={!autoOpen} />
      </label>
      {paid && (
        <fieldset className="op-pay">
          <legend>How will you pay {money(event.fee)}?</legend>
          <div className="op-methods">
            {[["cash", "Cash at the venue", "Pay the host when you arrive"], ["online", "Pay online", "Send it now and attach your receipt"]].map(([key, title, sub]) => (
              <label key={key} className={`op-method${method === key ? " on" : ""}`}>
                <input type="radio" name={`pay-${event.id}`} checked={method === key} onChange={() => setMethod(key)} />
                <b>{title}</b>
                <small>{sub}</small>
              </label>
            ))}
          </div>
          {online && (
            <div className="op-online">
              {event.payInfo && <p className="op-payinfo">{event.payInfo}</p>}
              <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} />
              {receipt ? (
                <div className="op-receipt-preview">
                  <img src={receipt} alt="Your payment receipt" />
                  <div>
                    <b><Check size={14} /> Receipt attached</b>
                    <span>
                      <button type="button" className="outline" onClick={() => file.current?.click()}>Replace</button>
                      <button type="button" className="text" onClick={() => setReceipt("")}>Remove</button>
                    </span>
                  </div>
                </div>
              ) : (
                <button type="button" className="op-drop" disabled={reading} onClick={() => file.current?.click()}>
                  <ImagePlus size={22} aria-hidden="true" />
                  <b>{reading ? "Preparing your picture…" : "Attach a screenshot of your receipt"}</b>
                  <small>Needed so the host can confirm your payment</small>
                </button>
              )}
              {receiptError && <p className="op-error" role="alert">{receiptError}</p>}
            </div>
          )}
        </fieldset>
      )}
      {paid && <p className="op-total"><span>Total</span><b>{money(event.fee)}</b></p>}
      {error && <p className="op-error" role="alert">{error}</p>}
      <div className="op-actions">
        {!autoOpen && <button type="button" className="outline" onClick={onCancel}>Cancel</button>}
        <button className="primary" disabled={busy || reading || !name.trim() || (online && !receipt)}>
          {busy ? "Sending…" : "Send request"}
        </button>
      </div>
      <p className="op-fineprint">{fineprint}</p>
    </form>
  );
}
