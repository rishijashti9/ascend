import type { AscendDB } from '@/core/db/db';
import { getDeviceId } from '@/core/db/hlc';
import { logError } from '@/core/errorLog';
import { getSettings, recordAction } from '@/core/pipeline';
import { addDays, currentTimeZone, dayBounds, dayOf, nowMs } from '@/core/time';
import { YOUTUBE_PACKAGES } from '@/data/entertainmentApps';
import type { ScreenBridge } from './bridge';
import { getRules } from './store';

/**
 * Reads the phone's daily totals into `screen_days` (task 11.6): today and yesterday (so
 * yesterday is final before its Digital discipline quest is judged at day close). Runs when the
 * app opens or comes back, and every 15 minutes while open — only while screen time is on and
 * Usage access is granted. YouTube time inside focus sessions is read separately (it doesn't
 * count, SPEC 6.8).
 */
export const READ_EVERY_MS = 15 * 60_000;

export async function readScreenDay(
  bridge: ScreenBridge,
  db: AscendDB,
  day: string,
): Promise<boolean> {
  const settings = await getSettings(db);
  const tz = currentTimeZone();
  const { start, end } = dayBounds(day, tz, settings.day_start_hour);
  const now = nowMs();
  const until = Math.min(now, end);
  if (until <= start) return false;
  const totals = await bridge.totals(start, until);

  const focus: Record<string, number> = {};
  const sessions = (await db.focus_sessions.where('day').equals(day).toArray()).filter(
    (s) => !s.deleted_at,
  );
  for (const s of sessions) {
    const from = Math.max(start, Date.parse(s.started_at));
    const to = Math.min(until, s.ended_at ? Date.parse(s.ended_at) : now);
    if (to <= from) continue;
    const inSession = await bridge.totals(from, to);
    for (const pkg of YOUTUBE_PACKAGES) {
      const sec = inSession.apps[pkg] ?? 0;
      if (sec > 0) focus[pkg] = (focus[pkg] ?? 0) + sec;
    }
  }

  const { value } = await recordAction<boolean>(
    {
      type: 'screen.saveDay',
      source: 'system',
      payload: {
        device_id: getDeviceId(),
        day,
        apps: totals.apps,
        focus,
        labels: totals.labels,
        games: totals.games,
      },
    },
    { db },
  );
  return value === true;
}

/** Today and yesterday, if screen time is on and Usage access is granted. */
export async function readScreenTime(bridge: ScreenBridge, db: AscendDB): Promise<number> {
  if (!bridge.available()) return 0;
  if (!(await getRules(db))?.enabled) return 0;
  try {
    if (!(await bridge.status()).usageAccess) return 0;
    const settings = await getSettings(db);
    const today = dayOf(nowMs(), currentTimeZone(), settings.day_start_hour);
    let saved = 0;
    for (const day of [addDays(today, -1), today]) {
      if (await readScreenDay(bridge, db, day)) saved++;
    }
    return saved;
  } catch (error) {
    logError(error, 'screen.read');
    return 0;
  }
}
