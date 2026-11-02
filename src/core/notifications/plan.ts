import type { DayString, Habit, QuestInstance, Settings } from '@/core/db/types';
import { isScheduled } from '@/core/engine/instances';
import { isDone } from '@/core/engine/progress';
import { addDays, dayNumber, instantAt, parseTime } from '@/core/time';
import type { PlannedNotification } from './types';

/**
 * What to remind and when, for the next 7 days (SPEC 8: scheduled a week ahead and
 * re-planned by the day rollover). Pure: the same data always gives the same list, with
 * stable keys, so re-planning after every change is cheap and never duplicates.
 */
export const DAYS_AHEAD = 7;

export interface PlanInput {
  now: number;
  tz: string;
  today: DayString;
  settings: Pick<Settings, 'wake_time' | 'wake_window_min' | 'day_start_hour' | 'notifications'>;
  startDay: DayString | null;
  habits: readonly Habit[];
  /** Today's quest instances (later days have none yet). */
  todayInstances: readonly Pick<QuestInstance, 'id' | 'source_id' | 'status'>[];
}

/** The instant a clock time happens within an app day (times before the day-start hour belong to the next calendar date). */
export function appInstant(day: DayString, hhmm: string, tz: string, dayStartHour: number): number {
  const date = parseTime(hhmm) < dayStartHour * 60 ? addDays(day, 1) : day;
  return instantAt(date, hhmm, tz);
}

export function planNotifications(input: PlanInput): PlannedNotification[] {
  const { settings, tz, startDay } = input;
  if (!startDay) return []; // not onboarded yet
  const doneToday = new Set(
    input.todayInstances.filter((i) => isDone(i.status)).map((i) => i.source_id),
  );
  const wakeHabit = input.habits.find(
    (h) => h.status === 'active' && h.auto_source === 'wake_checkin' && !h.deleted_at,
  );
  const list: PlannedNotification[] = [];

  for (let k = 0; k < DAYS_AHEAD; k++) {
    const day = addDays(input.today, k);
    if (day < startDay) continue;
    const dayN = dayNumber(startDay, day);

    // Wake-up check-in (SPEC 7): at wake time, one button, the tap time counts.
    if (
      settings.notifications.wake_checkin &&
      wakeHabit &&
      isScheduled(wakeHabit, day) &&
      !(k === 0 && doneToday.has(wakeHabit.id))
    ) {
      list.push({
        key: `wake:${day}`,
        kind: 'wake',
        at: appInstant(day, settings.wake_time, tz, settings.day_start_hour),
        day,
        title: `Day ${dayN}. Are you up?`,
        body: `Tap “I’m up” — it counts the moment you tap (on time for ${settings.wake_window_min} min).`,
        path: '/',
        wakeInstanceId: `${wakeHabit.id}:${day}`,
      });
    }
  }
  return list.filter((n) => n.at > input.now).sort((a, b) => a.at - b.at);
}
