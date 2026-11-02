import { instantAt } from '@/core/time';

/**
 * Wake-up check-in result for a tap at `tapMs` (pure, DECISIONS 1): by wake time + window
 * → on time (early taps too); until the late cutoff → late; after that → missed.
 */
export function wakeStatusAt(
  tapMs: number,
  day: string,
  settings: { wake_time: string; wake_window_min: number; wake_late_cutoff: string },
  tz: string,
): 'done_full' | 'done_late' | 'missed' {
  const onTimeUntil = instantAt(day, settings.wake_time, tz) + settings.wake_window_min * 60_000;
  const lateUntil = instantAt(day, settings.wake_late_cutoff, tz);
  if (tapMs <= onTimeUntil) return 'done_full';
  if (tapMs <= lateUntil) return 'done_late';
  return 'missed';
}
