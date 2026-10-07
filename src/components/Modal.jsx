import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useEscape } from "../hooks/useEscape";

export default function Modal({ title, label, close, children }) {
  useEscape(close);
  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <div className="modaltop">
          <div>
            <div className="eyebrow">{label}</div>
            <h3>{title}</h3>
          </div>
          <button className="icon" onClick={close} aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
