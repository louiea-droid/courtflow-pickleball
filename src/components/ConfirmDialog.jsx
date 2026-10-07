import { createPortal } from "react-dom";
import { useEscape } from "../hooks/useEscape";

export default function ConfirmDialog({ title, message, confirmLabel = "Remove", onCancel, onConfirm }) {
  useEscape(onCancel);
  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal confirm-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modalactions">
          <button className="outline" onClick={onCancel}>Cancel</button>
          <button className="danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
