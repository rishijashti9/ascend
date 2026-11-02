import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { getSettings, recordAction, type RolloverResult } from '@/core/pipeline';
import { currentTimeZone, dayBounds, dayOf, nowMs } from '@/core/time';

/**
 * Runs the day rollover (PLAN "Day rollover"): once at startup (awaited, so the first screen
 * shows the right day), again whenever the app comes back to the foreground, and on a timer
 * at the next day-start hour. Rollover is idempotent, so extra runs are harmless.
 */

let latest: RolloverResult | null = null;
let welcome: WelcomeBack | null = null;

/** After days away: shown once in today's System message (kept for the rest of that day). */
export interface WelcomeBack {
  day: string;
  daysAway: number;
  shieldsUsed: number;
}

/** The most recent rollover result. */
export function latestRollover(): RolloverResult | null {
  return latest;
}

/** Welcome-back data for today, if the app was just reopened after days away. */
export function welcomeBack(today: string | null): WelcomeBack | null {
  return welcome && welcome.day === today ? welcome : null;
}

export async function runRollover(database: AscendDB = defaultDb): Promise<RolloverResult | null> {
  try {
    const result = await recordAction<RolloverResult>(
      { type: 'day.rollover', payload: {}, source: 'rollover' },
      { db: database },
    );
    latest = result.value ?? latest;
    // A later run the same day (app resumed) must not erase the welcome-back note.
    if (latest && latest.daysAway > 0) {
      welcome = { day: latest.today, daysAway: latest.daysAway, shieldsUsed: latest.shieldsUsed };
    }
    return latest;
  } catch (error) {
    logError(error, 'rollover');
    return null;
  }
}

/** Milliseconds until the next day-start boundary (plus a small margin). */
async function msUntilNextDay(database: AscendDB): Promise<number> {
  const { day_start_hour } = await getSettings(database);
  const tz = currentTimeZone();
  const now = nowMs();
  const { end } = dayBounds(dayOf(now, tz, day_start_hour), tz, day_start_hour);
  return Math.max(1_000, end - now + 5_000);
}

export async function startRollover(database: AscendDB = defaultDb): Promise<() => void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const schedule = async () => {
    clearTimeout(timer);
    if (stopped) return;
    // Browsers cap timers at ~24.8 days; a day is far below that.
    const wait = await msUntilNextDay(database).catch(() => 60 * 60_000);
    timer = setTimeout(() => void tick(), wait);
  };
  const tick = async () => {
    await runRollover(database);
    await schedule();
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') void tick();
  };

  await runRollover(database);
  await schedule();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
