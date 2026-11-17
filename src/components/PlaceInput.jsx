import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { Map as MapIcon, MapPin } from "lucide-react";

const MapPicker = lazy(() => import("./MapPicker")); // Leaflet loads only when the map opens

// A text field for a place with suggestions as you type, from Photon (OpenStreetMap search: free, no key, CORS open).
// Typing anything is still allowed; a suggestion only fills the text. Results lean toward the Philippines.
// ponytail: public Photon instance (fair use); move to Google Places or a self-hosted Photon if traffic grows.
export const PHOTON = "https://photon.komoot.io";
const API = `${PHOTON}/api/?limit=6&lang=en&lat=12.8&lon=121.8&q=`;

export function placeLabel(p) {
  // Short enough for the club header: place, street, city (or the area / province without one); the country only outside the Philippines.
  const parts = [p.name, p.street, p.city || p.locality || p.district || p.county, p.city ? null : p.state, p.countrycode === "PH" ? null : p.country];
  return [...new Set(parts.filter(Boolean))].join(", ");
}

export default function PlaceInput({ value, onChange, className, placeholder, ariaLabel, maxLength = 100 }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(-1);
  const [mapOpen, setMapOpen] = useState(false);
  const typed = useRef(false); // only search after the person types, not on the saved value
  const id = useId();

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 3) { setItems([]); return undefined; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(API + encodeURIComponent(q), { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => {
          const labels = [...new Set(d.features.map((f) => placeLabel(f.properties)).filter((l) => l && l.length <= maxLength))];
          setItems(labels);
          setAt(-1);
          setOpen(labels.length > 0);
        })
        .catch(() => {}); // offline or blocked: the field still works as plain text
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, maxLength]);

  const pick = (label) => { typed.current = false; onChange(label); setOpen(false); };
  const onKey = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setAt((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
    } else if (e.key === "Enter" && at >= 0) { e.preventDefault(); pick(items[at]); }
    else if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
  };

  return (
    <div className="place-input">
      <input
        className={className} value={value} maxLength={maxLength} placeholder={placeholder} aria-label={ariaLabel} autoComplete="off"
        role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list"
        aria-activedescendant={open && at >= 0 ? `${id}-${at}` : undefined}
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onKeyDown={onKey} onBlur={() => setOpen(false)} onFocus={() => setOpen(items.length > 0)}
      />
      <button type="button" className="place-map-btn" aria-label="Pick on the map" title="Pick on the map" onClick={() => setMapOpen(true)}>
        <MapIcon size={17} />
      </button>
      {open && (
        <ul className="place-list" id={id} role="listbox">
          {items.map((label, i) => (
            <li key={label} id={`${id}-${i}`} role="option" aria-selected={i === at}
              onMouseDown={(e) => { e.preventDefault(); pick(label); }}>
              <MapPin size={14} aria-hidden="true" /><span>{label}</span>
            </li>
          ))}
          <li className="place-credit" aria-hidden="true">Places from OpenStreetMap</li>
        </ul>
      )}
      {mapOpen && <Suspense fallback={null}><MapPicker value={value} onPick={pick} close={() => setMapOpen(false)} /></Suspense>}
    </div>
  );
}
