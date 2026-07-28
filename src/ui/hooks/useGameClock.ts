import { useEffect, useState } from 'react';
import { systemClock } from '@/engine/clock';

/**
 * Wall-clock ticks for timer UIs (TECHNICAL_ARCHITECTURE.md §6). Components
 * derive remaining time from activity timestamps — state never counts down.
 */
export function useGameClock(intervalMs = 1000): number {
  const [now, setNow] = useState(() => systemClock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(systemClock.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
