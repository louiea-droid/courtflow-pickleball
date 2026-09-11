import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { COURT_LEVEL_OPTIONS } from "../utils/courtLevels";

const SLUG = {
  "Any Level": "any",
  Beginner: "beginner",
  "Advanced Beginner": "advanced-beginner",
  Intermediate: "intermediate",
  "Advanced Intermediate": "advanced-intermediate",
  Advanced: "advanced",
  Expert: "expert",
};

const MENU_MAX_HEIGHT = 200;

export default function CourtLevelSelect({ level, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const value = level || "Any Level";
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const courtEl = btnRef.current.closest(".court");
    const courtRect = courtEl?.getBoundingClientRect();
    const nextCard = courtEl?.nextElementSibling;
    const nextRect = nextCard?.getBoundingClientRect();
    // Only treat the next card as a boundary if it actually sits below this
    // one (stacked mobile layout) — in a multi-column grid it sits beside it.
    const nextIsBelow = nextRect && courtRect && nextRect.top >= courtRect.bottom - 4;
    const lowerBound = Math.min(
      window.innerHeight - 8,
      nextIsBelow ? nextRect.top - 8 : Infinity
    );
    const spaceBelow = lowerBound - rect.bottom;
    const spaceAbove = rect.top - 8;
    const openUpward = spaceBelow < 140 && spaceAbove > spaceBelow;
    const available = openUpward ? spaceAbove : spaceBelow;
    setPos({
      left: rect.left,
      width: Math.max(190, rect.width),
      top: openUpward ? undefined : rect.bottom + 6,
      bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
      maxHeight: Math.max(80, Math.min(MENU_MAX_HEIGHT, available - 6)),
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

  return (
    <div className="level-select">
      <button
        ref={btnRef}
        type="button"
        className={`level-badge level-${SLUG[value] || "any"}`}
        onClick={() => setOpen((o) => !o)}
      >
        {value} <ChevronDown size={11} />
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="level-menu level-menu-portal"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
        >
          {COURT_LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`level-menu-item ${opt === value ? "active" : ""}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
