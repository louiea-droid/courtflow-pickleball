import { CircleAlert } from "lucide-react";
import StarDisplay from "./StarDisplay";
import LockMark from "./LockMark";

// One shared "who is this player" unit — name, optionally with an inline
// skill rating and/or extra meta content underneath. Used everywhere a
// player is listed (Dashboard, Queue, Players, Stats, Live Board) so the
// identity treatment stays visually consistent app-wide.
// `lock` (optional partner name) puts a small link mark after the name; the name shows on hover or tap.
// `warn` (optional text) puts a small alert mark after the name, e.g. "Set gender to play Mixed Doubles".
export default function PersonBadge({ name, skill, size, warn, lock, children }) {
  return (
    <span className={`person${size === "lg" ? " big" : ""}`}>
      <span className="person-info">
        <b>
          {name}
          {warn && <span className="gender-warn" role="img" title={warn} aria-label={warn}><CircleAlert size={13} /></span>}
          {lock && <LockMark name={lock} />}
        </b>
        {skill != null && <small><StarDisplay value={skill} /></small>}
        {children}
      </span>
    </span>
  );
}
