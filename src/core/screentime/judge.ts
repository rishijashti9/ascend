import type { AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { getSettings, recordAction } from '@/core/pipeline';
import { addDays, currentTimeZone, dayBounds, dayOf, nowMs } from '@/core/time';

/** How far back finished days are (re)judged — e.g. after a few days without opening ASCEND. */
export const JUDGE_DAYS = 7;

/**
 * Judges the Digital discipline quest for the last few finished days (SPEC 6.8): each one runs
 * as a real action that happened one minute before its day ended, so it counts for that day
 * even after the day has closed. Days already done, or without readings, are left alone.
 */
export async function judgeRecentDays(db: AscendDB): Promise<number> {
  let done = 0;
  try {
    const settings = await getSettings(db);
    const tz = currentTimeZone();
    const today = dayOf(nowMs(), tz, settings.day_start_hour);
    for (let i = JUDGE_DAYS; i >= 1; i--) {
      const day = addDays(today, -i);
      const { end } = dayBounds(day, tz, settings.day_start_hour);
      const { value } = await recordAction<boolean>(
        {
          type: 'screen.judgeDay',
          source: 'screen_time',
          occurred_at: new Date(end - 60_000).toISOString(),
          payload: { day },
        },
        { db },
      );
      if (value) done++;
    }
  } catch (error) {
    logError(error, 'screen.judge');
  }
  return done;
}
