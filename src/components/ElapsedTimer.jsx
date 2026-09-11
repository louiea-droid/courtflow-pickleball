import { useState, useEffect } from "react";
import { elapsed } from "../utils/format";

export default function ElapsedTimer({ start }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <small>{elapsed(start)}</small>;
}
