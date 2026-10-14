import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useEscape } from "../hooks/useEscape";

export default function ConfirmDialog({ title, message, confirmLabel = "Remove", confirmClass = "danger", onCancel, onConfirm }) {
  useEscape(onCancel);
  const cancel = useRef(null);
  const titleId = useId();
  useEffect(() => cancel.current?.focus(), []); // the safe choice has focus, so Enter never confirms by accident
  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h3 id={titleId}>{title}</h3>
        <p>{message}</p>
        <div className="modalactions">
          <button className="outline" ref={cancel} onClick={onCancel}>Cancel</button>
          <button className={confirmClass} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
