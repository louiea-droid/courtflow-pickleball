import { useState, useEffect } from "react";
import { elapsed } from "../utils/format";

// `alertAfterMin` (Settings → Queue rules) turns the timer red once a game runs long. 0 = off.
export default function ElapsedTimer({ start, alertAfterMin = 0 }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const over = alertAfterMin > 0 && Date.now() - (start || Date.now()) >= alertAfterMin * 60000;
  return (
    <small className={over ? "timer-over" : undefined} title={over ? `Past the ${alertAfterMin}-minute game alert` : undefined}>
      {elapsed(start)}
    </small>
  );
}
