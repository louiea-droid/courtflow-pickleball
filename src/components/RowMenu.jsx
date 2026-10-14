import { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { useEscape } from "../hooks/useEscape";

// A "more" button for a row's occasional actions (refund, remove), kept out of the way of the common one.
// items = [{ label, onSelect, danger? }]. Escape, a click outside and tabbing out close it.
function MenuList({ items, onEscape, close }) {
  useEscape(onEscape);
  return (
    <div className="row-menu-list" role="menu">
      {items.map((item) => (
        <button
          type="button" role="menuitem" key={item.label} className={item.danger ? "danger-item" : undefined}
          onClick={() => { close(); item.onSelect(); }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function RowMenu({ label, items }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const outside = (e) => { if (root.current && !root.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);
  return (
    <div
      className="row-menu" ref={root}
      onBlur={(e) => { if (open && e.relatedTarget && !root.current.contains(e.relatedTarget)) setOpen(false); }}
    >
      <button type="button" ref={button} className="row-menu-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Ellipsis size={18} aria-hidden="true" />
      </button>
      {open && (
        <MenuList
          items={items} close={() => setOpen(false)}
          onEscape={() => { setOpen(false); button.current?.focus(); }}
        />
      )}
    </div>
  );
}
