import { CircleAlert } from "lucide-react";
import StarDisplay from "./StarDisplay";

// One shared "who is this player" unit — name, optionally with an inline
// skill rating and/or extra meta content underneath. Used everywhere a
// player is listed (Dashboard, Queue, Players, Stats, Live Board) so the
// identity treatment stays visually consistent app-wide.
// `warn` (optional text) puts a small alert mark after the name, e.g. "Set gender to play Mixed Doubles".
export default function PersonBadge({ name, skill, size, warn, children }) {
  return (
    <span className={`person${size === "lg" ? " big" : ""}`}>
      <span className="person-info">
        <b>
          {name}
          {warn && <span className="gender-warn" role="img" title={warn} aria-label={warn}><CircleAlert size={13} /></span>}
        </b>
        {skill != null && <small><StarDisplay value={skill} /></small>}
        {children}
      </span>
    </span>
  );
}
