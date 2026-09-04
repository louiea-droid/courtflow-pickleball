import { useState } from "react";
import Modal from "./Modal";

export default function SessionModal({ close, submit }) {
  const [location, setLocation] = useState("Centro Pickle Club");
  const [courts, setCourts] = useState(2);
  const [format, setFormat] = useState("Doubles");
  const [rotation, setRotation] = useState("Balanced");

  return (
    <Modal title="New Open Play" label="SESSION SETUP" close={close}>
      <p className="modal-note">Starting a new session clears the current roster — every player will need to check in again.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit({ location, courts: +courts, format, rotation, createdAt: Date.now() });
        }}
      >
        <label>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} autoFocus />
        </label>
        <div className="formgrid">
          <label>
            Courts
            <select value={courts} onChange={(e) => setCourts(e.target.value)}>
              {[1, 2, 3, 4].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label>
            Format
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option>Doubles</option>
              <option>Singles</option>
            </select>
          </label>
        </div>
        <label>
          Rotation
          <select value={rotation} onChange={(e) => setRotation(e.target.value)}>
            <option>Balanced</option>
            <option>Skill Separated</option>
            <option>Winners / Losers</option>
          </select>
        </label>
        <div className="modalactions">
          <button type="button" className="outline" onClick={close}>Cancel</button>
          <button className="primary">Start Session</button>
        </div>
      </form>
    </Modal>
  );
}
