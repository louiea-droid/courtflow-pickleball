import { useState } from "react";
import DeleteAccountDialog from "../components/DeleteAccountDialog";
import PageTitle from "../components/PageTitle";
import Settings from "./Settings";

const TABS = [["queue", "Queue"], ["scoring", "Scoring and voice"], ["cost", "Cost"], ["display", "Display"], ["danger", "Danger zone"]];

// A club's settings in tabs (the tab is kept in the address, e.g. #scoring). Every control saves straight to the club.
// The club's name, photos, place and visibility are in Edit club on the header, not here.
export default function ClubSettings({ club, isOwner, notify, onUpdate, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const tabs = isOwner ? TABS : TABS.slice(0, -1);
  const [tab, setTab] = useState(() => tabs.find(([id]) => `#${id}` === location.hash)?.[0] || "queue");
  const pick = (id) => { setTab(id); history.replaceState(history.state, "", `#${id}`); };
  const save = async (patch) => { await onUpdate(patch); notify("Saved."); };
  const rules = { ...club.rules };
  const costDefaults = { ...club.costDefaults };
  const live = { ...club.live };
  const display = { ...club.display };

  return (
    <div className="club-settings-page">
      <PageTitle title="Settings" sub="For this club only. Name, photos and visibility are under Edit club." />
      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => pick(id)}>{label}</button>
        ))}
      </div>
      <Settings
        mode="club" isOwner={isOwner} section={tab}
        session={{ location: club.name, defaults: club.defaults }}
        onSetDefaults={(defaults) => save({ defaults })}
        rules={rules} costDefaults={costDefaults} live={live} display={display}
        onSetRules={(change) => save({ rules: { ...rules, ...change } })}
        onSetCostDefaults={(change) => save({ costDefaults: { ...costDefaults, ...change } })}
        onSetLive={(change) => save({ live: { ...live, ...change } })}
        onSetDisplay={(change) => save({ display: { ...display, ...change } })}
        onDeleteClub={() => setConfirmDelete(true)}
      />
      {confirmDelete && (
        <DeleteAccountDialog
          variant="club" clubName={club.name} needsPassword={false} loading={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              await onDelete();
              return "";
            } catch {
              setDeleting(false);
              return "Couldn't delete the club. Check your connection and try again.";
            }
          }}
        />
      )}
    </div>
  );
}
