import { useState } from "react";
import { Star } from "lucide-react";
import { skillLevelLabel } from "../utils/courtLevels";

export default function StarRating({ value, onChange, max = 6 }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="star-rating" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn ${n <= display ? "filled" : ""}`}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-pressed={n === value}
        >
          <Star fill={n <= display ? "currentColor" : "none"} />
        </button>
      ))}
      <span className="star-rating-value">{skillLevelLabel(value)}</span>
    </div>
  );
}
