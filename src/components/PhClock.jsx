import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatPHClock } from "../utils/format";

export default function PhClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ph-clock" title="Philippine Time (Asia/Manila)">
      <Clock size={14} />
      <span>{formatPHClock(now)}</span>
      <b>PHT</b>
    </div>
  );
}
