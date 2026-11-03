import { logError } from '@/core/errorLog';
import { appStore } from '@/core/state/app';
import { progressStore } from '@/core/state/progress';
import { todayStore } from '@/core/state/today';
import { currentTimeZone } from '@/core/time';
import type { WidgetBridge } from './bridge';
import { buildSnapshot } from './snapshot';

/**
 * Keeps the widgets' snapshot up to date: rebuilt shortly after today's quests, progress or
 * settings change (that includes the day rollover, which reloads today), written only when it
 * really changed.
 */
export function startWidgetWriter(bridge: WidgetBridge, delayMs = 500): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = '';
  const write = () => {
    const today = todayStore.getState();
    const progress = progressStore.getState().progress;
    const { settings, profile } = appStore.getState();
    if (
      today.status !== 'ready' ||
      !today.day ||
      !progress ||
      !settings ||
      !profile?.onboarded_at
    ) {
      return;
    }
    const json = JSON.stringify(
      buildSnapshot({
        day: today.day,
        tz: currentTimeZone(),
        settings,
        startDay: profile.start_day,
        level: progress.level,
        streak: progress.streak.streak,
        lowEnergy: today.lowEnergy,
        quests: today.daily,
      }),
    );
    if (json === last) return;
    last = json;
    bridge.setSnapshot(json).catch((error: unknown) => {
      last = '';
      logError(error, 'widget.snapshot');
    });
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, delayMs);
  };
  const stops = [
    todayStore.subscribe(schedule),
    progressStore.subscribe(schedule),
    appStore.subscribe(schedule),
  ];
  schedule();
  return () => {
    if (timer) clearTimeout(timer);
    stops.forEach((s) => s());
  };
}
