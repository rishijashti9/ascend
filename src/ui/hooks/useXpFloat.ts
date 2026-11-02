import { useCallback, useEffect, useState } from 'react';
import { progressStore } from '@/core/state/progress';

/**
 * Measures the XP an action really added (after streak bonus, soft cap and Daily Clear) by
 * comparing the player's total before and after, so the floating "+XP" is always honest.
 */
export function useXpFloat() {
  const [float, setFloat] = useState<{ key: number; xp: number } | null>(null);

  useEffect(() => {
    if (!float) return;
    const t = setTimeout(() => setFloat(null), 1300);
    return () => clearTimeout(t);
  }, [float]);

  const track = useCallback(async (fn: () => Promise<boolean>): Promise<boolean> => {
    const total = () => progressStore.getState().progress?.level.totalXp ?? 0;
    const before = total();
    const ok = await fn();
    const gained = total() - before;
    if (ok && gained > 0) setFloat({ key: Date.now(), xp: gained });
    return ok;
  }, []);

  return { float, track };
}
