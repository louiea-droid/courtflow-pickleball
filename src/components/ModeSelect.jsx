import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { MODE_OPTIONS, COMING_SOON_MODES } from "../data/constants";

export default function ModeSelect({ mode, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="mode-select" ref={ref}>
      <button type="button" className="mode-select-trigger" onClick={() => setOpen((o) => !o)}>
        <span className="mode-select-label">MODE</span>
        <b>{mode}</b>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="mode-menu">
          {MODE_OPTIONS.map((m) => {
            const soon = COMING_SOON_MODES.includes(m);
            return (
              <button
                key={m}
                type="button"
                disabled={soon}
                className={`mode-menu-item ${m === mode ? "active" : ""} ${soon ? "soon" : ""}`}
                onClick={() => { onChange(m); setOpen(false); }}
              >
                {m}
                {soon && <span className="soon-tag">Soon</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
