import { formatDay } from "../utils/format";

export default function DateTile({ date }) {
  const [wd, rest] = formatDay(date).split(", ");
  const [mon, day] = rest.split(" ");
  return (
    <span className="date-tile" aria-hidden="true">
      <small>{wd}</small><b>{day}</b><small>{mon}</small>
    </span>
  );
}
