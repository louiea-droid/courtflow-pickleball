import { useEffect, useRef } from "react";

// Esc closes the topmost open dialog only: every dialog registers here and the last one
// registered (the one on top) handles the key.
const stack = [];
const onKey = (e) => {
  if (e.key === "Escape" && stack.length) stack[stack.length - 1]();
};

export function useEscape(onClose) {
  const latest = useRef(onClose);
  latest.current = onClose;
  useEffect(() => {
    const entry = () => latest.current();
    if (!stack.length) document.addEventListener("keydown", onKey);
    stack.push(entry);
    return () => {
      stack.splice(stack.indexOf(entry), 1);
      if (!stack.length) document.removeEventListener("keydown", onKey);
    };
  }, []);
}
