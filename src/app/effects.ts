import { useSyncExternalStore } from 'react';
import type { EffectsLevel, Settings } from '@/core/db/types';
import { useAppState } from '@/core/state/app';

/**
 * Settings → Effects (Phase 12): Full / Light / Off. The system "reduce motion" setting always
 * means Off. Every visual effect asks this first; Off shows the same information with no motion.
 */
const REDUCE = '(prefers-reduced-motion: reduce)';

function subscribeReduce(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined;
  const media = window.matchMedia(REDUCE);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function reduceMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(REDUCE).matches;
}

export function effectsLevel(
  settings: Pick<Settings, 'effects'> | null | undefined,
  reduce: boolean,
): EffectsLevel {
  if (reduce) return 'off';
  return settings?.effects ?? 'full';
}

/** The effects level to use right now (re-renders when the setting or reduce motion change). */
export function useEffectsLevel(): EffectsLevel {
  const settings = useAppState((s) => s.settings);
  const reduce = useSyncExternalStore(subscribeReduce, reduceMotion, () => false);
  return effectsLevel(settings, reduce);
}
