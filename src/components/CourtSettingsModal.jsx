import Modal from "./Modal";
import Select from "./Select";
import { ColorSwatches, SettingsRow } from "../views/Settings";
import { DEFAULT_DISPLAY, MODE_SELECT_OPTIONS, TEAM_PRESETS, normalizeMode } from "../data/constants";

// One game's courts, format and queue mode (they used to be the club's Session defaults in Settings).
// Each change saves straight to the event; "Proceed to game" reads them, and a live game follows them.
// A live game's court count is changed on its Dashboard, where the courts themselves are added and removed.
// The team colors are the club's (`club.display`), so they apply to every game of the club.
export default function CourtSettingsModal({ event, defaults = {}, display = {}, onSave, onSetDisplay, close }) {
  const live = event.status === "live";
  const courts = event.courts ?? defaults.courts ?? 2;
  const format = event.format ?? defaults.format ?? "Doubles";
  const mode = normalizeMode(event.mode ?? defaults.mode ?? "Balanced");
  const team1 = display.team1 || DEFAULT_DISPLAY.team1;
  const team2 = display.team2 || DEFAULT_DISPLAY.team2;
  return (
    <Modal title="Court settings" label={event.title} close={close}>
      <div className="account-panel">
        <SettingsRow title="Courts" body={live ? "Add or remove courts from the game's Dashboard." : "How many courts the game starts with."}>
          {live ? <b>{courts}</b> : (
            <div className="account-select"><Select value={courts} onChange={(n) => onSave({ courts: n })} options={[1, 2, 3, 4]} /></div>
          )}
        </SettingsRow>
        <SettingsRow title="Format" body="Doubles puts four players on a court, Singles puts two.">
          <div className="account-select"><Select value={format} onChange={(f) => onSave({ format: f })} options={["Doubles", "Singles"]} /></div>
        </SettingsRow>
        <SettingsRow title="Mode" body="How the queue picks players. You can still switch it from the game's sidebar.">
          <div className="account-select"><Select value={mode} onChange={(m) => onSave({ mode: m })} options={MODE_SELECT_OPTIONS} /></div>
        </SettingsRow>
        <SettingsRow title="Team 1 color" body="Team 1 on every court of this club, the Live Board, and its win button.">
          <ColorSwatches label="Team 1 color" cssVar="--team1" presets={TEAM_PRESETS} value={team1} onChange={(c) => onSetDisplay({ team1: c })} />
        </SettingsRow>
        <SettingsRow title="Team 2 color" body="Team 2 on every court of this club, the Live Board, and its win button.">
          <ColorSwatches label="Team 2 color" cssVar="--team2" presets={TEAM_PRESETS} value={team2} onChange={(c) => onSetDisplay({ team2: c })} />
        </SettingsRow>
      </div>
    </Modal>
  );
}
