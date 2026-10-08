import { useRef, useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import Modal from "./Modal";
import QrCode from "./QrCode";

export default function ShareModal({
  url, close, title = "Share Live Board", label = "PUBLIC LINK", openLabel = "Open Live Board", qr = false,
  hint = "Anyone with this link can view a read-only, live-updating view of the courts and queue. No sign-in required.",
}) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  const copyLink = async () => {
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
    <Modal title={title} label={label} close={close}>
      <div className="share-linkbox">
        <input ref={inputRef} readOnly value={url} onFocus={(e) => e.target.select()} />
        <button className={copied ? "primary" : "outline"} onClick={copyLink}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {qr ? (
        <div className="share-qr"><QrCode value={url} size={168} label="QR code for the open play page" /></div>
      ) : (
        <a className="share-preview" href={url} target="_blank" rel="noopener noreferrer">
          <iframe src={url} title="Live board preview" tabIndex={-1} />
          <div className="share-preview-overlay">
            <ExternalLink size={16} /> Open preview in new tab
          </div>
        </a>
      )}

      <p className="share-hint">{hint}</p>

      <div className="modalactions">
        <button className="outline" onClick={close}>Close</button>
        <a className="primary" href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} /> {openLabel}
        </a>
      </div>
    </Modal>
  );
}
