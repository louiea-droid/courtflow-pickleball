import { useEffect, useState } from "react";

const localToday = () => new Date().toLocaleDateString("en-CA");

// The device's date (YYYY-MM-DD), kept current: a page left open past midnight moves on to the new day.
export function useToday() {
  const [today, setToday] = useState(localToday);
  useEffect(() => {
    const t = setInterval(() => setToday(localToday()), 60000);
    return () => clearInterval(t);
  }, []);
  return today;
}
