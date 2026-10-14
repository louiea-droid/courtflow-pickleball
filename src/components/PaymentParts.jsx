import { Check, Search } from "lucide-react";
import { money } from "../utils/format";

// The pieces of a payment list, shared by the game's Payment page and the event page so both look and behave the same.

// What is collected, what is left, and a bar. `paidCount` of `ofCount` are the people who owe (waitlist and refunds excluded).
export function FeeProgress({ collected, total, remaining, paidCount, ofCount }) {
  const pct = total ? Math.round((collected / total) * 100) : 0;
  return (
    <div className="fee-progress">
      <div className="fee-progress-top">
        <div className="fee-collected"><b>{money(collected)}</b><span>of {money(total)} collected</span></div>
        <div className="fee-remaining"><span>Remaining balance</span><b>{money(remaining)}</b></div>
      </div>
      <div className="fee-bar" role="progressbar" aria-label="Fees collected" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
      <small>{paidCount} of {ofCount} paid</small>
    </div>
  );
}

// Cash or GCash ("online" is what is stored). Tapping the other option switches.
export function MethodSwitch({ name, method, onChange }) {
  const current = method === "online" ? "online" : "cash";
  return (
    <div className="method-switch" role="group" aria-label={`Payment method for ${name}`}>
      {[["cash", "Cash"], ["online", "GCash"]].map(([key, label]) => (
        <button type="button" key={key} aria-pressed={current === key} onClick={() => current !== key && onChange(key)}>{label}</button>
      ))}
    </div>
  );
}

// "paid" | "refunded" | "unpaid": a tap marks paid, or unpaid when it was paid or refunded.
export function StatusPill({ name, status, onClick }) {
  const label = status === "paid" ? "paid" : status === "refunded" ? "refunded" : "unpaid";
  return (
    <button
      type="button" className={`fee-status ${label}`} onClick={onClick}
      aria-label={`${name}: ${label}. Mark ${status === "unpaid" ? "paid" : "unpaid"}.`}
    >
      {status === "paid" ? <><Check size={14} strokeWidth={3} /> Paid</> : status === "refunded" ? "Refunded" : "Unpaid"}
    </button>
  );
}

// Filter chips with counts plus a name search. `filters` = [[key, label, count], ...]; the caller decides which to show.
export function FeeFilters({ filters, value, onChange, search, onSearch }) {
  return (
    <div className="fee-toolbar">
      {filters.length > 0 && (
        <div className="fee-chips" role="group" aria-label="Show players">
          {filters.map(([key, label, count]) => (
            <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>
              {label}<span>{count}</span>
            </button>
          ))}
        </div>
      )}
      <label className="checkin-search fee-search">
        <Search size={15} aria-hidden="true" />
        <input type="search" aria-label="Search players" placeholder="Search players" value={search} onChange={(e) => onSearch(e.target.value)} />
      </label>
    </div>
  );
}
