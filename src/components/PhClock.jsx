import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatClock, timeZoneLabel } from "../utils/format";

// Club clock — time zone and 12/24h come from Settings → Display.
export default function PhClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ph-clock" title="Club time">
      <Clock size={14} />
      <span>{formatClock(now)}</span>
      <b>{timeZoneLabel()}</b>
    </div>
  );
}
