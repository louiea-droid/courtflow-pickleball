import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

const MENU_MAX_HEIGHT = 240;

export default function Select({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpward = spaceBelow < 140 && spaceAbove > spaceBelow;
    const available = openUpward ? spaceAbove : spaceBelow;
    setPos({
      left: rect.left,
      width: rect.width,
      top: openUpward ? undefined : rect.bottom + 6,
      bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
      maxHeight: Math.max(80, Math.min(MENU_MAX_HEIGHT, available)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onReflow = (e) => { if (menuRef.current?.contains(e.target)) return; setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  const normalized = options.map((o) => (typeof o === "object" && o !== null ? o : { value: o }));
  const current = normalized.find((o) => o.value === value);

  return (
    <div className={`field-select ${open ? "open" : ""}`}>
      <button ref={btnRef} type="button" className="field-select-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{current?.label ?? current?.value ?? value}</span>
        <ChevronDown size={16} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="field-select-menu field-select-menu-portal"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
        >
          {normalized.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                disabled={o.disabled}
                className={`field-select-item ${active ? "active" : ""} ${o.disabled ? "disabled" : ""}`}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                <span>{o.label ?? o.value}</span>
                <span className="field-select-item-end">
                  {o.tag && <span className="soon-tag">{o.tag}</span>}
                  {active && <Check size={14} />}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
