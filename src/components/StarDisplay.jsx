import { Star } from "lucide-react";
import { skillLevelLabel } from "../utils/courtLevels";

export default function StarDisplay({ value, max = 6 }) {
  return (
    <span className="star-display" title={skillLevelLabel(value)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <Star key={n} className={n <= value ? "filled" : ""} fill={n <= value ? "currentColor" : "none"} />
      ))}
    </span>
  );
}
