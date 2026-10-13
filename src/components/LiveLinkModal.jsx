import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseConfigured } from "../firebase";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import QrCode from "./QrCode";
import { useDocs } from "../hooks/useLiveDocs";
import { liveUrl } from "../utils/liveBoard";
import { createLiveLink, renewLiveLink, syncLiveInfo } from "../utils/liveData";

// The host shares a game's Live Board: a link and QR code for a TV or tablet, and New link to stop every old screen.
// `info` is what the board shows that a screen can't read itself (club name, title, format, display settings).
export default function LiveLinkModal({ base, info, close, notify }) {
  const [link, setLink] = useState({ key: null, ready: false });
  const viewers = useDocs([...base, "viewers"]);
  const [confirmNew, setConfirmNew] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
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
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { inputRef.current?.select(); document.execCommand("copy"); }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal title="Share Live Board" label="TV SCREEN" close={close}>
      {!link.key ? (
        <div className="umpire-row">
          <div><b>Live Board link</b><p>Open it on a TV or tablet at the venue: courts, live scores, the queue and results, updating by themselves.</p></div>
          <button className="primary" disabled={!link.ready} onClick={() => createLiveLink(base, info).catch(fail("create the link"))}>Create link</button>
        </div>
      ) : (
        <>
          <div className="share-linkbox">
            <input ref={inputRef} readOnly value={url} onFocus={(e) => e.target.select()} />
            <button className={copied ? "primary" : "outline"} onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="share-qr"><QrCode value={url} size={168} label="QR code for the Live Board" /></div>
          <p className="share-hint">
            Works while the game is live and for 12 hours after it ends. {viewers.length === 1 ? "1 screen is" : `${viewers.length} screens are`} showing it.
          </p>
          <div className="modalactions">
            <button className="outline" onClick={() => setConfirmNew(true)}>New link</button>
            <a className="primary" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Open Live Board</a>
          </div>
        </>
      )}
      {confirmNew && (
        <ConfirmDialog
          title="Make a new Live Board link?"
          message="Every screen showing the old link stops at once. Open the new link on the screens that should keep showing the game."
          confirmLabel="New link"
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => { setConfirmNew(false); renewLiveLink(base, info, viewers).catch(fail("make a new link")); }}
        />
      )}
    </Modal>
  );
}
