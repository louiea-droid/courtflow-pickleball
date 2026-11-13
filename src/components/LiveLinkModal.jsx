import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, Maximize2, MonitorPlay, RefreshCw, Share2, UserCheck, X } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import QrCode from "./QrCode";
import { useDocs } from "../hooks/useLiveDocs";
import { liveUrl } from "../utils/liveBoard";
import { createLiveLink, renewLiveLink, syncLiveInfo } from "../utils/liveData";
import { renewCheckinCode, setCheckin } from "../utils/checkinData";
import { checkinUrl } from "../utils/selfCheckin";
import { Toggle } from "../views/Settings";

// The game's Share window (owner-approved layout A, 2026-11-13): tabs for the Live Board (a TV) and Self check-in (players),
// each with its own QR, link, Copy, Send (the phone's share sheet, so a co-host gets it) and, for check-in, a full-screen sign.
const TAB_KEY = "courtflow.shareTab";
const readTab = () => { try { return localStorage.getItem(TAB_KEY) === "checkin" ? "checkin" : "live"; } catch { return "live"; } };

function LinkRow({ url, notify, text }) {
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { ref.current?.select(); document.execCommand("copy"); }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const send = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "CourtWave", text, url }); } catch { /* closed the sheet */ }
    } else { await copy(); notify("Link copied. Paste it in a message."); }
  };
  return (
    <>
      <div className="share-linkbox share-linkrow">
        <input ref={ref} readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link" />
        <button className={copied ? "primary" : "outline"} onClick={copy} aria-label="Copy link" title="Copy link">{copied ? <Check size={15} /> : <Copy size={15} />}<span>{copied ? "Copied" : "Copy"}</span></button>
        <button className="outline" onClick={send} aria-label="Send link" title="Send"><Share2 size={15} /><span>Send</span></button>
      </div>
    </>
  );
}

// A co-host's phone or an entrance tablet as a check-in sign: big QR and code, screen kept awake. Tap to close.
function FullSign({ url, code, ask, title, close }) {
  useEffect(() => {
    let lock = null;
    if ("wakeLock" in navigator) navigator.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => {});
    // Esc closes only the sign: caught on the way down, before the Share window's own Esc handler hears it.
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    window.addEventListener("keydown", onKey, true);
    return () => { lock?.release(); window.removeEventListener("keydown", onKey, true); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // On the page itself: inside the Share window (which animates with a transform) "fixed" would stay window-sized.
  return createPortal(
    <div className="checkin-sign" role="dialog" aria-label="Check-in sign" onClick={close}>
      <button className="checkin-sign-close" aria-label="Close"><X size={20} /></button>
      <b className="checkin-sign-title">Check in here</b>
      {title && <span className="checkin-sign-sub">{title}</span>}
      <div className="checkin-sign-qr"><QrCode value={url} size={260} label="QR code to check in" /></div>
      {ask ? <><span className="checkin-sign-sub">then type</span><b className="checkin-sign-code">{code}</b></> : <span className="checkin-sign-sub">Scan with your phone camera</span>}
    </div>,
    document.body,
  );
}

function CheckinTab({ base, notify, title }) {
  const [state, setState] = useState(null);
  const [full, setFull] = useState(false);
  const path = base.join("/");
  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onSnapshot(doc(db, ...base, "private", "checkin"), (s) => setState(s.data() || { on: false }), () => setState({ on: false }));
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!state) return <p className="share-hint">Loading…</p>;
  const ask = state.ask !== false;
  const fail = () => notify("Couldn't save. Check your connection and try again.", 4000);
  const save = (change) => setCheckin(base, { ...state, ...change }).catch(fail);
  // With the code off it rides in the link, so scanning is enough; with it on, people read it at the venue.
  const url = state.code ? checkinUrl(window.location.origin, base[1], base[3]) + (ask ? "" : `&code=${state.code}`) : "";
  return (
    <div className="share-tab">
      <div className="share-switch-row">
        <div><b>Self check-in</b><p>Players scan, {ask ? "type the code and " : ""}their name, and join.</p></div>
        <Toggle label="Self check-in" checked={state.on} onChange={(on) => save({ on })} />
      </div>
      {state.on && (
        <>
          <div className="share-switch-row">
            <div><b>Ask for the code</b><p>{ask ? "A photo of the QR alone isn't enough." : "Scanning is enough. New code stops old QRs."}</p></div>
            <Toggle label="Ask for the code" checked={ask} onChange={(v) => save({ ask: v })} />
          </div>
          <div className="share-pair">
            <div className="share-qr"><QrCode value={url} size={112} label="QR code to check in" /></div>
            <div className="share-side">
              <span className="share-code"><small>{ask ? "Code" : "Code · in the link"}</small><b>{state.code}</b></span>
              <button className="outline" onClick={() => renewCheckinCode(base, { on: true, ask }).then(() => notify("New code. Old QR codes and codes stop working at once.")).catch(fail)}><RefreshCw size={14} /> New code</button>
              <button className="primary" onClick={() => setFull(true)}><Maximize2 size={14} /> Full screen</button>
            </div>
          </div>
          <LinkRow url={url} notify={notify} text={ask ? `Check in to ${title || "open play"} (type the code shown at the venue)` : `Check in to ${title || "open play"}`} />
          {full && <FullSign url={url} code={state.code} ask={ask} title={title} close={() => setFull(false)} />}
        </>
      )}
    </div>
  );
}

function LiveTab({ base, info, notify }) {
  const [link, setLink] = useState({ key: null, ready: false });
  const viewers = useDocs([...base, "viewers"]);
  const [confirmNew, setConfirmNew] = useState(false);
  const path = base.join("/");
  const synced = useRef(false);
  useEffect(() => {
    if (!firebaseConfigured) return undefined;
    return onSnapshot(doc(db, ...base, "private", "live"),
      (s) => setLink({ key: s.data()?.key || null, ready: true }),
      () => setLink({ key: null, ready: true }));
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  // Screens show the current title and settings: refresh the copy once each time the panel opens.
  useEffect(() => {
    if (link.key && !synced.current) { synced.current = true; syncLiveInfo(base, info); }
  }, [link.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const fail = (what) => () => notify(`Couldn't ${what}. Check your connection and try again.`, 4000);
  const url = link.key ? liveUrl(window.location.origin, base[1], base[3], link.key) : "";

  if (!link.key) {
    return (
      <div className="share-tab">
        <div className="share-switch-row">
          <div><b>Live Board</b><p>Open it on a TV or tablet at the venue: courts, live scores, the queue and results, updating by themselves.</p></div>
          <button className="primary" disabled={!link.ready} onClick={() => createLiveLink(base, info).catch(fail("create the link"))}>Create link</button>
        </div>
      </div>
    );
  }
  return (
    <div className="share-tab">
      {/* Same shape as Self check-in (two rows, the QR pair, the link at the bottom) so the fixed card stays full. */}
      <div className="share-switch-row">
        <div><b>Live Board</b><p>Courts, live scores and the queue on a TV or tablet at the venue.</p></div>
        <span className={`share-live-pill${viewers.length ? " on" : ""}`}>{viewers.length === 1 ? "1 screen" : `${viewers.length} screens`}</span>
      </div>
      <div className="share-switch-row">
        <div><b>Link</b><p>Works while the game is live and 12 hours after it ends. New link stops every old screen.</p></div>
      </div>
      <div className="share-pair">
        <div className="share-qr"><QrCode value={url} size={112} label="QR code for the Live Board" /></div>
        <div className="share-side">
          <a className="primary" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open Live Board</a>
          <button className="outline" onClick={() => setConfirmNew(true)}><RefreshCw size={14} /> New link</button>
          <span className="share-code share-note"><small>Scan it on the TV&apos;s browser, or Send it to whoever runs the screen.</small></span>
        </div>
      </div>
      <LinkRow url={url} notify={notify} text={`Live Board: ${info.title || "open play"}`} />
      {confirmNew && (
        <ConfirmDialog
          title="Make a new Live Board link?"
          message="Every screen showing the old link stops at once. Open the new link on the screens that should keep showing the game."
          confirmLabel="New link"
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => { setConfirmNew(false); renewLiveLink(base, info, viewers).catch(fail("make a new link")); }}
        />
      )}
    </div>
  );
}

export default function LiveLinkModal({ base, info, close, notify }) {
  const [tab, setTab] = useState(readTab);
  const pick = (t) => { setTab(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* not remembered */ } };
  return (
    <Modal title="Share" label="OPEN PLAY" close={close} className="share-modal">
      <div className="settings-tabs share-tabs" role="tablist" aria-label="What to share">
        <button type="button" role="tab" aria-selected={tab === "live"} onClick={() => pick("live")}><MonitorPlay size={15} /> Live Board</button>
        <button type="button" role="tab" aria-selected={tab === "checkin"} onClick={() => pick("checkin")}><UserCheck size={15} /> Self check-in</button>
      </div>
      {/* Both tabs share one grid cell, so the window keeps one size whichever is open (owner: "make it fixed"). */}
      <div className="share-body">
        <div className="share-pane" hidden={tab !== "live"}><LiveTab base={base} info={info} notify={notify} /></div>
        <div className="share-pane" hidden={tab !== "checkin"}><CheckinTab base={base} notify={notify} title={info.title} /></div>
      </div>
    </Modal>
  );
}
