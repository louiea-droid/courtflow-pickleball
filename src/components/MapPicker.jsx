import { useEffect, useRef, useState } from "react";
import { Crosshair } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Modal from "./Modal";
import { PHOTON, placeLabel } from "./PlaceInput";

const PH = [12.8, 121.8];
const dot = (ll) => L.circleMarker(ll, { radius: 10, weight: 3, color: "#0f2a22", fillColor: "#c6ef1f", fillOpacity: 1 });

// Pick a place on a map (OpenStreetMap tiles): tap to set the pin, or use your location; the nearest named place
// (Photon reverse search) becomes the label. Loaded only when opened (PlaceInput imports it lazily).
export default function MapPicker({ value, onPick, close }) {
  const box = useRef(null);
  const map = useRef(null);
  const pin = useRef(null);
  const [label, setLabel] = useState("");
  const [state, setState] = useState(""); // "" | "looking" | "locating" | an error line

  const place = (lat, lon, zoom) => {
    const m = map.current;
    if (!m) return;
    if (pin.current) pin.current.setLatLng([lat, lon]);
    else pin.current = dot([lat, lon]).addTo(m);
    if (zoom) m.setView([lat, lon], zoom);
    setLabel("");
    setState("looking");
    fetch(`${PHOTON}/reverse?lang=en&lat=${lat}&lon=${lon}`)
      .then((r) => r.json())
      .then((d) => { const p = d.features?.[0]?.properties; setLabel(p ? placeLabel(p) : ""); setState(p ? "" : "No named place here. Try a spot closer to the venue."); })
      .catch(() => setState("Couldn't look up this spot. Check your connection."));
  };

  useEffect(() => {
    const m = L.map(box.current, { zoomControl: true }).setView(PH, 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
    m.on("click", (e) => place(e.latlng.lat, e.latlng.lng));
    map.current = m;
    // Start where the field already points, if Photon knows it.
    if (value.trim()) {
      fetch(`${PHOTON}/api/?limit=1&lang=en&lat=${PH[0]}&lon=${PH[1]}&q=${encodeURIComponent(value.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          const c = d.features?.[0]?.geometry?.coordinates;
          if (c && map.current) { m.setView([c[1], c[0]], 15); pin.current = dot([c[1], c[0]]).addTo(m); setLabel(value.trim()); }
        })
        .catch(() => {});
    }
    return () => { m.remove(); map.current = null; pin.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- set up once per opening

  const locate = () => {
    if (!navigator.geolocation) { setState("This browser can't share your location."); return; }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => place(p.coords.latitude, p.coords.longitude, 17),
      () => setState("Location is off or blocked. Tap the map instead."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <Modal title="Pick on the map" label="LOCATION" close={close} className="map-modal">
      <div className="map-box" ref={box} />
      <button type="button" className="outline map-locate" onClick={locate} disabled={state === "locating"}>
        <Crosshair size={15} /> {state === "locating" ? "Finding you…" : "Use my location"}
      </button>
      <p className="map-label" role="status">
        {state === "looking" ? "Looking up this spot…" : label || (state && state !== "locating" ? state : "Tap the map where you play.")}
      </p>
      <div className="modalactions">
        <button type="button" className="outline" onClick={close}>Cancel</button>
        <button type="button" className="primary" disabled={!label || state === "looking"} onClick={() => { onPick(label.slice(0, 100)); close(); }}>Use this place</button>
      </div>
    </Modal>
  );
}
