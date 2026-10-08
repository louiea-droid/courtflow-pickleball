import { useState } from "react";
import ClubProfileSettings from "../components/ClubProfileSettings";
import DeleteAccountDialog from "../components/DeleteAccountDialog";
import PageTitle from "../components/PageTitle";
import Settings from "./Settings";

// A club's settings: its profile, then the same session defaults, queue rules, cost defaults and
// display that used to live on the account. Every control saves straight to the club.
export default function ClubSettings({ club, isOwner, notify, onUpdate, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const save = async (patch) => { await onUpdate(patch); notify("Saved."); };
  const rules = { ...club.rules };
  const costDefaults = { ...club.costDefaults };
  const live = { ...club.live };
  const display = { ...club.display };

  return (
    <div className="page-narrow">
      <PageTitle title="Settings" sub="These apply to this club only." />
      <ClubProfileSettings club={club} isOwner={isOwner} onSave={save} />
      <Settings
        mode="club" isOwner={isOwner}
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
