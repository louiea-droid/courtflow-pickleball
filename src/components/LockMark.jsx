import { useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";

// A small link icon that marks a player as locked in with a partner. The partner's name shows on hover
// (or keyboard focus) and, for touch screens, on tap; a tap elsewhere closes it again.
export default function LockMark({ name }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);
  return (
    <span className={`lock-wrap${open ? " open" : ""}`} ref={ref}>
      <button type="button" className="lock-mark" aria-label={`Locked with ${name}`} aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        <Link2 size={13} />
      </button>
      <span className="lock-tip" role="tooltip">{name}</span>
    </span>
  );
}
