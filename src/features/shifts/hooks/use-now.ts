import { useEffect, useState } from "react";

/** The current time, refreshed every `intervalMs`. Use for live timers. */
export function useNow(intervalMs = 1_000, enabled = true): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [enabled, intervalMs]);

  return now;
}
