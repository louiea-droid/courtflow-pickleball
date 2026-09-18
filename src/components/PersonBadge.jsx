import StarDisplay from "./StarDisplay";

// One shared "who is this player" unit — name, optionally with an inline
// skill rating and/or extra meta content underneath. Used everywhere a
// player is listed (Dashboard, Queue, Players, Stats, Live Board) so the
// identity treatment stays visually consistent app-wide.
export default function PersonBadge({ name, skill, size, children }) {
  return (
    <span className={`person${size === "lg" ? " big" : ""}`}>
      <span className="person-info">
        <b>{name}</b>
        {skill != null && <small><StarDisplay value={skill} /></small>}
        {children}
      </span>
    </span>
  );
}
