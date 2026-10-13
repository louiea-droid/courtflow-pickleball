import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import QrCode from "./QrCode";
import { useDocs } from "../hooks/useLiveDocs";
import { useUmpireLink } from "../hooks/useUmpireLink";
import { assignCourt, createLink, releaseCourt, renewLink, syncSettings } from "../utils/umpireData";
import { umpireUrl } from "../utils/umpire";

// The host's umpire panel: the volunteer link and its QR code, the quick session's on/off switch, who holds each
// court (release or assign), and New link. kind: "quick" | "event"; settings: { style, to }.
export default function UmpireModal({ base, kind, courts, claims, umpiresOn, settings, onToggle, close, notify }) {
  const link = useUmpireLink(base);
  const umpires = useDocs([...base, "umpires"]);
  const [confirmNew, setConfirmNew] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const enabled = kind === "event" || umpiresOn;
  const url = link.code ? umpireUrl(window.location.origin, base, link.code) : "";
  const fail = (what) => () => notify(`Couldn't ${what}. Check your connection and try again.`, 4000);

  // Volunteers score the way the Dashboard does: keep the link's copy of the style and target current.
  useEffect(() => {
    if (enabled && link.code && (link.style !== settings.style || link.to !== settings.to || link.autoRecord !== settings.autoRecord)) syncSettings(base, settings);
  }, [enabled, link.code, link.style, link.to, link.autoRecord, settings.style, settings.to, settings.autoRecord]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Modal title="Umpires" label="VOLUNTEER SCORING" close={close}>
      {kind === "quick" && (
        <div className="umpire-row">
          <div>
            <b>Allow volunteer umpires</b>
            <p>When off, nobody can open the umpire link, even if they have it.</p>
          </div>
          <button className={`pill toggle ${umpiresOn ? "" : "off"}`} onClick={() => onToggle(!umpiresOn)}>
            {umpiresOn ? "● ON" : "○ OFF"}
          </button>
        </div>
      )}
      {enabled && !link.code && (
        <div className="umpire-row">
          <div><b>Umpire link</b><p>Volunteers open it on their phone, pick a court and keep its score. No account needed.</p></div>
          <button className="primary" disabled={!link.ready} onClick={() => createLink(base, settings).catch(fail("create the link"))}>Create link</button>
        </div>
      )}
      {enabled && link.code && (
        <>
          <div className="share-linkbox">
            <input ref={inputRef} readOnly value={url} onFocus={(e) => e.target.select()} />
            <button className={copied ? "primary" : "outline"} onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="share-qr"><QrCode value={url} size={168} label="QR code for the umpire link" /></div>
          <div className="umpire-courts">
            {courts.map((c) => {
              const claim = claims.find((x) => x.id === c.id);
              const name = c.name || `Court ${c.courtNumber}`;
              return (
                <div className="umpire-row" key={c.id}>
                  <b>{name}</b>
                  {claim ? <span>{claim.name}</span> : <span className="umpire-free">Free</span>}
                  <div className="umpire-actions">
                    {claim && <button className="outline" onClick={() => releaseCourt(base, c.id).catch(fail("release the court"))}>Release</button>}
                    {umpires.length > 0 && (
                      <select aria-label={`Assign an umpire to ${name}`} value=""
                        onChange={(e) => {
                          const u = umpires.find((x) => x.id === e.target.value);
                          if (u) assignCourt(base, c.id, u, claims).catch(fail("assign the umpire"));
                        }}>
                        <option value="">Assign...</option>
                        {umpires.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="modalactions">
            <button className="outline" onClick={() => setConfirmNew(true)}>New link</button>
            <button className="primary" onClick={close}>Done</button>
          </div>
        </>
      )}
      {confirmNew && (
        <ConfirmDialog
          title="Make a new umpire link?"
          message="Every old link stops working and every volunteer umpire is signed off their court. Share the new link with the people who should keep scoring."
          confirmLabel="New link"
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => { setConfirmNew(false); renewLink(base, { ...settings, umpires, claims }).catch(fail("make a new link")); }}
        />
      )}
    </Modal>
  );
}
