import type { DayString, IsoTime } from '@/core/db/types';
import { diffDays } from '@/core/time';

const WEEK_MS = 7 * 86_400_000;

/**
 * Web backup reminder (PLAN 2.13): in a browser, data lives only in that browser until sync
 * exists, so a gentle note appears when the last export is a week old (or, if there has
 * never been one, after the first week). "Later" snoozes it for 3 days. Not shown in the
 * Android app, which gets its own automatic weekly backup (task 7.7).
 */
export function backupReminderDue(input: {
  native: boolean;
  startDay: DayString | null;
  today: DayString | null;
  lastExportAt: IsoTime | null;
  snoozeUntil: IsoTime | null;
  nowMs: number;
}): boolean {
  const { native, startDay, today, lastExportAt, snoozeUntil, nowMs } = input;
  if (native || !startDay || !today) return false;
  if (snoozeUntil && Date.parse(snoozeUntil) > nowMs) return false;
  if (lastExportAt) return nowMs - Date.parse(lastExportAt) >= WEEK_MS;
  return diffDays(startDay, today) >= 7;
}
