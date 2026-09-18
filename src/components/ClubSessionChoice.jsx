import { createPortal } from "react-dom";
import { RefreshCw, Sparkles } from "lucide-react";

export default function ClubSessionChoice({ clubName, loading, onContinue, onNew, onCancel }) {
  return createPortal(
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && !loading && onCancel()}>
      <div className="modal confirm-modal">
        <h3>Welcome back, {clubName}</h3>
        <p>This club already has a session. Pick up where you left off, or start over with a clean roster?</p>
        <div className="club-choice-actions">
          <button className="primary" onClick={onContinue} disabled={loading}>
            <RefreshCw size={15} /> Continue previous session
          </button>
          <span className="club-choice-hint">Keeps your roster, renews everyone's game count. Last results are saved automatically.</span>

          <button className="outline" onClick={onNew} disabled={loading}>
            <Sparkles size={15} /> Start a new session
          </button>
          <span className="club-choice-hint">Clears the roster and courts completely — starts from scratch.</span>
        </div>
        <button className="text club-choice-cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
