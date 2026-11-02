import { useEffect, useState } from 'react';
import { nowMs } from '@/core/time';

/** The current time (app clock), refreshed every `everyMs` so time-based UI stays right. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    const id = setInterval(() => setNow(nowMs()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
