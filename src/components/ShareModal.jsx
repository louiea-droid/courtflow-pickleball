import { useRef, useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import Modal from "./Modal";

export default function ShareModal({ url, close }) {
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
    <Modal title="Share Live Board" label="PUBLIC LINK" close={close}>
      <div className="share-linkbox">
        <input ref={inputRef} readOnly value={url} onFocus={(e) => e.target.select()} />
        <button className={copied ? "primary" : "outline"} onClick={copyLink}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <a className="share-preview" href={url} target="_blank" rel="noopener noreferrer">
        <iframe src={url} title="Live board preview" tabIndex={-1} />
        <div className="share-preview-overlay">
          <ExternalLink size={16} /> Open preview in new tab
        </div>
      </a>

      <p className="share-hint">
        Anyone with this link can view a read-only, live-updating view of the courts and queue. No sign-in required.
      </p>

      <div className="modalactions">
        <button className="outline" onClick={close}>Close</button>
        <a className="primary" href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={15} /> Open Live Board
        </a>
      </div>
    </Modal>
  );
}
