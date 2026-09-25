import { useState } from "react";
import { Pencil, Plus, LogOut, Trash2, Check, X, KeyRound, RefreshCw } from "lucide-react";
import ChangePasswordDialog from "../components/ChangePasswordDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import Select from "../components/Select";
import { ACCENT_PRESETS, MODE_SELECT_OPTIONS, TEAM_PRESETS } from "../data/constants";
import { money } from "../utils/format";
import { readableOn } from "../utils/theme";

const FALLBACK_DEFAULTS = { courts: 2, format: "Doubles", mode: "Balanced" };

const ALERT_OPTIONS = [
  { value: 0, label: "Off" },
  ...[10, 12, 15, 20, 25, 30].map((m) => ({ value: m, label: `After ${m} min` })),
];
const AFTER_GAME_OPTIONS = [
  { value: "rotate", label: "All rotate off" },
  { value: "stay", label: "Winners stay on" },
];
const STREAK_OPTIONS = [2, 3, 4, 5].map((n) => ({ value: n, label: `${n} wins in a row` }));
const ON_OFF = [{ value: "off", label: "Off" }, { value: "on", label: "On" }];
const SHOW_HIDE = [{ value: "show", label: "Shown" }, { value: "hide", label: "Hidden" }];
const THEME_OPTIONS = [
  { value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Match device" },
];
const CLOCK_OPTIONS = [{ value: "12", label: "12-hour" }, { value: "24", label: "24-hour" }];
const TIME_ZONES = [
  ["Asia/Manila", "Philippines"], ["Asia/Singapore", "Singapore / Malaysia"], ["Asia/Hong_Kong", "Hong Kong"],
  ["Asia/Tokyo", "Japan / Korea"], ["Asia/Bangkok", "Thailand / Vietnam"], ["Asia/Jakarta", "Indonesia (Jakarta)"],
  ["Asia/Dubai", "UAE"], ["Australia/Sydney", "Australia (Sydney)"], ["Europe/London", "UK"],
  ["America/New_York", "US Eastern"], ["America/Chicago", "US Central"], ["America/Denver", "US Mountain"],
  ["America/Los_Angeles", "US Pacific"], ["Pacific/Honolulu", "Hawaii"], ["UTC", "UTC"],
].map(([value, label]) => ({ value, label }));
const ROUND_OPTIONS = [
  { value: 0, label: "Exact split" },
  ...[1, 5, 10, 20].map((n) => ({ value: n, label: `Up to ₱${n}` })),
];

function SettingsRow({ title, body, children }) {
  return (
    <div className="account-row">
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {children}
    </div>
  );
}

// Preset swatches plus a custom picker. The custom picker previews on the CSS
// variable while dragging (React onChange fires every step) and saves once on
// the native change event, so dragging doesn’t write to Firestore each frame.
function ColorSwatches({ label, cssVar, presets, value, onChange }) {
  const isCustom = !presets.some((p) => p.value === value);
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {presets.map((p) => (
        <button
          key={p.value} type="button" role="radio" aria-checked={value === p.value} aria-label={p.label} title={p.label}
          className="swatch" style={{ "--swatch": p.value, "--swatch-ink": readableOn(p.value) }} onClick={() => onChange(p.value)}
        >
          {value === p.value ? <Check size={14} strokeWidth={3} /> : null}
        </button>
      ))}
      <label className={`swatch swatch-custom ${isCustom ? "active" : ""}`} style={isCustom ? { "--swatch": value, "--swatch-ink": readableOn(value) } : undefined} title="Custom color">
        {isCustom ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
        <input
          type="color" aria-label={`Custom ${label.toLowerCase()}`} key={value} defaultValue={value}
          onChange={(e) => document.documentElement.style.setProperty(cssVar, e.target.value)}
          ref={(el) => { if (el) el.onchange = (e) => onChange(e.target.value); }}
        />
      </label>
    </div>
  );
}

export default function Settings({
  session, onRenameClub, onNewSession, onSwitchClub, onDeleteAccount, onChangePassword, onSetPasswordHint,
  onSetDefaults, rules, onSetRules, costDefaults, onSetCostDefaults, live, onSetLive, display, onSetDisplay,
}) {
  const [confirmNewLink, setConfirmNewLink] = useState(false);
  const defaults = { ...FALLBACK_DEFAULTS, ...session.defaults };
  const setDefault = (change) => onSetDefaults({ ...defaults, ...change });
  const [editingRate, setEditingRate] = useState(false);
  const [rate, setRate] = useState("");
  const startEditRate = () => { setRate(costDefaults.rate ? String(costDefaults.rate) : ""); setEditingRate(true); };
  const saveRate = () => {
    const next = Math.max(0, parseFloat(rate) || 0);
    if (next !== costDefaults.rate) onSetCostDefaults({ rate: next });
    setEditingRate(false);
  };
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(session.location);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [editingHint, setEditingHint] = useState(false);
  const [hint, setHint] = useState(session.passwordHint || "");

  const startEdit = () => { setName(session.location); setEditing(true); };
  const save = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== session.location) onRenameClub(trimmed);
    setEditing(false);
  };

  const startEditHint = () => { setHint(session.passwordHint || ""); setEditingHint(true); };
  const saveHint = () => {
    const trimmed = hint.trim();
    if (trimmed !== (session.passwordHint || "")) onSetPasswordHint(trimmed);
    setEditingHint(false);
  };

  return (
    <div className="account-groups">
      <div className="account-group">
        <div className="eyebrow">Club</div>
        <div className="panel account-panel">
          <SettingsRow title="Club name" body="Shown throughout the app and on your public Live Board link.">
            {editing ? (
              <div className="account-edit">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  autoFocus
                />
                <button className="icon" title="Save" onClick={save}><Check size={14} /></button>
                <button className="icon" title="Cancel" onClick={() => setEditing(false)}><X size={14} /></button>
              </div>
            ) : (
              <div className="account-edit">
                <b>{session.location}</b>
                <button className="icon" title="Rename" onClick={startEdit}><Pencil size={13} /></button>
              </div>
            )}
          </SettingsRow>

          <SettingsRow title="Password" body="Used to log back into this club. Can't be looked up or displayed, only changed.">
            <button className="outline" onClick={() => setShowChangePassword(true)}>
              <KeyRound size={14} /> Change Password
            </button>
          </SettingsRow>

          <SettingsRow
            title="Password hint"
            body="Shown on the login screen once this club name is typed — a private note to jog your memory, never the password itself."
          >
            {editingHint ? (
              <div className="account-edit">
                <input
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveHint();
                    if (e.key === "Escape") setEditingHint(false);
                  }}
                  placeholder="e.g. same as the wifi"
                  autoFocus
                />
                <button className="icon" title="Save" onClick={saveHint}><Check size={14} /></button>
                <button className="icon" title="Cancel" onClick={() => setEditingHint(false)}><X size={14} /></button>
              </div>
            ) : (
              <div className="account-edit">
                <b>{session.passwordHint || "Not set"}</b>
                <button className="icon" title="Edit hint" onClick={startEditHint}><Pencil size={13} /></button>
              </div>
            )}
          </SettingsRow>
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Session defaults</div>
        <div className="panel account-panel">
          <SettingsRow title="Courts" body="How many courts a new session starts with.">
            <div className="account-select">
              <Select value={defaults.courts} onChange={(courts) => setDefault({ courts })} options={[1, 2, 3, 4]} />
            </div>
          </SettingsRow>
          <SettingsRow title="Format" body="Doubles puts four players on a court, Singles puts two.">
            <div className="account-select">
              <Select value={defaults.format} onChange={(format) => setDefault({ format })} options={["Doubles", "Singles"]} />
            </div>
          </SettingsRow>
          <SettingsRow title="Mode" body="How the queue picks players when a new session starts. You can still switch it from the sidebar.">
            <div className="account-select">
              <Select value={defaults.mode} onChange={(mode) => setDefault({ mode })} options={MODE_SELECT_OPTIONS} />
            </div>
          </SettingsRow>
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Queue rules</div>
        <div className="panel account-panel">
          <SettingsRow title="Game length alert" body="Turns a court's timer red once a game runs this long.">
            <div className="account-select">
              <Select value={rules.gameAlertMinutes} onChange={(gameAlertMinutes) => onSetRules({ gameAlertMinutes })} options={ALERT_OPTIONS} />
            </div>
          </SettingsRow>
          <SettingsRow title="After a game" body="Winners can hold the court and face the next players in the queue.">
            <div className="account-select">
              <Select
                value={rules.winnersStay ? "stay" : "rotate"}
                onChange={(v) => onSetRules({ winnersStay: v === "stay" })}
                options={AFTER_GAME_OPTIONS}
              />
            </div>
          </SettingsRow>
          {rules.winnersStay && (
            <SettingsRow title="Winners come off after" body="Caps how long one team can hold a court so everyone gets games.">
              <div className="account-select">
                <Select value={rules.maxWinStreak} onChange={(maxWinStreak) => onSetRules({ maxWinStreak })} options={STREAK_OPTIONS} />
              </div>
            </SettingsRow>
          )}
          <SettingsRow
            title="Avoid repeat partners"
            body="Pairs each foursome so nobody teams up with a recent partner. Balanced mode always does this; Mixed Doubles keeps its own pairing."
          >
            <div className="account-select">
              <Select
                value={rules.avoidRepeatPartners ? "on" : "off"}
                onChange={(v) => onSetRules({ avoidRepeatPartners: v === "on" })}
                options={ON_OFF}
              />
            </div>
          </SettingsRow>
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Cost</div>
        <div className="panel account-panel">
          <SettingsRow title="Court rate" body="Pre-filled on the Cost page each time you log a rental.">
            {editingRate ? (
              <div className="account-edit">
                <input
                  type="number" min="0" step="0.01" value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRate();
                    if (e.key === "Escape") setEditingRate(false);
                  }}
                  placeholder="₱ per hour"
                  autoFocus
                />
                <button className="icon" title="Save" onClick={saveRate}><Check size={14} /></button>
                <button className="icon" title="Cancel" onClick={() => setEditingRate(false)}><X size={14} /></button>
              </div>
            ) : (
              <div className="account-edit">
                <b>{costDefaults.rate ? `${money(costDefaults.rate)} / hr` : "Not set"}</b>
                <button className="icon" title="Edit rate" onClick={startEditRate}><Pencil size={13} /></button>
              </div>
            )}
          </SettingsRow>
          <SettingsRow title="Round each share" body="Rounds every player's share up to the nearest ₱1, ₱5, ₱10 or ₱20, so what you collect always covers the rental.">
            <div className="account-select">
              <Select value={costDefaults.roundTo} onChange={(roundTo) => onSetCostDefaults({ roundTo })} options={ROUND_OPTIONS} />
            </div>
          </SettingsRow>
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Live Board</div>
        <div className="panel account-panel">
          <SettingsRow title="Public Live Board" body="When off, anyone opening your link sees a notice instead of the courts.">
            <div className="account-select">
              <Select value={live.enabled ? "on" : "off"} onChange={(v) => onSetLive({ enabled: v === "on" })} options={ON_OFF} />
            </div>
          </SettingsRow>
          <SettingsRow title="Link" body="Makes a new link and stops every old one, including any TV already showing the board.">
            <button className="outline" onClick={() => setConfirmNewLink(true)}><RefreshCw size={14} /> New Link</button>
          </SettingsRow>
          {[
            ["showSkill", "Skill stars", "Star ratings next to player names."],
            ["showQueueRank", "Queue position", "The 1, 2, 3 numbers in the waiting queue."],
            ["showStats", "Games and wins", "Each waiting player's game and win counts."],
          ].map(([key, title, body]) => (
            <SettingsRow key={key} title={title} body={body}>
              <div className="account-select">
                <Select value={live[key] ? "show" : "hide"} onChange={(v) => onSetLive({ [key]: v === "show" })} options={SHOW_HIDE} />
              </div>
            </SettingsRow>
          ))}
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Display</div>
        <div className="panel account-panel">
          <SettingsRow title="Theme" body="Match device follows each phone or TV’s own light or dark setting.">
            <div className="account-select">
              <Select value={display.theme} onChange={(theme) => onSetDisplay({ theme })} options={THEME_OPTIONS} />
            </div>
          </SettingsRow>
          <SettingsRow title="Theme color" body="Buttons, highlights, and active tabs. Pick a preset or your own.">
            <ColorSwatches label="Theme color" cssVar="--accent" presets={ACCENT_PRESETS} value={display.accent} onChange={(accent) => onSetDisplay({ accent })} />
          </SettingsRow>
          <SettingsRow title="Team 1 color" body="Team 1 on every court, the Live Board, and its win button.">
            <ColorSwatches label="Team 1 color" cssVar="--team1" presets={TEAM_PRESETS} value={display.team1} onChange={(team1) => onSetDisplay({ team1 })} />
          </SettingsRow>
          <SettingsRow title="Team 2 color" body="Team 2 on every court, the Live Board, and its win button.">
            <ColorSwatches label="Team 2 color" cssVar="--team2" presets={TEAM_PRESETS} value={display.team2} onChange={(team2) => onSetDisplay({ team2 })} />
          </SettingsRow>
          <SettingsRow title="Time zone" body="Used for the clock, check-in times, and dates across the app and Live Board.">
            <div className="account-select">
              <Select value={display.timeZone} onChange={(timeZone) => onSetDisplay({ timeZone })} options={TIME_ZONES} />
            </div>
          </SettingsRow>
          <SettingsRow title="Clock" body="12-hour shows 1:05 PM, 24-hour shows 13:05.">
            <div className="account-select">
              <Select value={display.hour12 ? "12" : "24"} onChange={(v) => onSetDisplay({ hour12: v === "12" })} options={CLOCK_OPTIONS} />
            </div>
          </SettingsRow>
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Session</div>
        <div className="panel account-panel">
          <SettingsRow title="New Session" body="Clears the roster, courts, and match log and starts fresh. Stats are archived first.">
            <button className="outline" onClick={onNewSession}><Plus size={14} /> Start New Session</button>
          </SettingsRow>

          <SettingsRow title="Switch Club" body="Signs you out. Log back in with the password to pick up right where you left off.">
            <button className="outline" onClick={onSwitchClub}><LogOut size={14} /> Switch Club</button>
          </SettingsRow>
        </div>
      </div>

      <div className="account-group">
        <div className="eyebrow">Danger Zone</div>
        <div className="panel account-panel account-danger">
          <SettingsRow title="Delete Account" body="Permanently erases this club and everything in it. Cannot be undone.">
            <button className="danger" onClick={onDeleteAccount}><Trash2 size={14} /> Delete Account</button>
          </SettingsRow>
        </div>
      </div>

      {confirmNewLink && (
        <ConfirmDialog
          title="Make a new Live Board link?"
          message="Every old link stops working, including screens already showing the board. Share the new one from Share Live Board."
          confirmLabel="Make New Link"
          onCancel={() => setConfirmNewLink(false)}
          onConfirm={() => { setConfirmNewLink(false); onSetLive({ key: crypto.randomUUID().slice(0, 8) }); }}
        />
      )}

      {showChangePassword && (
        <ChangePasswordDialog
          onCancel={() => setShowChangePassword(false)}
          onSubmit={async (current, next) => {
            const err = await onChangePassword(current, next);
            if (!err) setShowChangePassword(false);
            return err;
          }}
        />
      )}
    </div>
  );
}
