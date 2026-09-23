import { useState } from "react";
import Modal from "./Modal";
import Select from "./Select";
import { MODE_OPTIONS, COMING_SOON_MODES } from "../data/constants";

export default function SessionModal({ close, submit, session }) {
  const isEdit = Boolean(session);
  const [location, setLocation] = useState(session?.location || "Centro Pickle Club");
  const [courts, setCourts] = useState(session?.courts || 2);
  const modeOptions = MODE_OPTIONS.map((m) => ({
    value: m,
    disabled: COMING_SOON_MODES.includes(m),
    tag: COMING_SOON_MODES.includes(m) ? "Soon" : undefined,
  }));
  const [format, setFormat] = useState(session?.format || "Doubles");
  const [mode, setMode] = useState(session?.mode || session?.rotation || "Balanced");

  return (
    <Modal title={isEdit ? "Edit Club" : "New Open Play"} label="SESSION SETUP" close={close}>
      {isEdit
        ? <p className="modal-note info">Just the club name — courts live on the Dashboard, and mode is in the sidebar.</p>
        : <p className="modal-note">Starting a new session clears the current roster — every player will need to check in again. Game/win totals are saved to Stats → Past Sessions first.</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = { location, courts: +courts, format, mode };
          submit(isEdit ? data : { ...data, createdAt: Date.now() });
        }}
      >
        <label>
          {isEdit ? "Club name" : "Session name"}
          <input value={location} onChange={(e) => setLocation(e.target.value)} autoFocus />
        </label>
        {!isEdit && (
          <>
            <div className="formgrid">
              <label>
                Courts
                <Select value={courts} onChange={setCourts} options={[1, 2, 3, 4]} />
              </label>
              <label>
                Format
                <Select value={format} onChange={setFormat} options={["Doubles", "Singles"]} />
              </label>
            </div>
            <label>
              Mode
              <Select value={mode} onChange={setMode} options={modeOptions} />
            </label>
          </>
        )}
        <div className="modalactions">
          <button type="button" className="outline" onClick={close}>Cancel</button>
          <button className="primary">{isEdit ? "Save Changes" : "Start Session"}</button>
        </div>
      </form>
    </Modal>
  );
}
