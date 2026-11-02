import type { DayString, Habit, QuestInstance, Settings } from '@/core/db/types';
import { isRecoveryId, isScheduled } from '@/core/engine/instances';
import { isDone } from '@/core/engine/progress';
import { addDays, dayNumber, instantAt, localParts, parseTime } from '@/core/time';
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
  settings: Pick<
    Settings,
    'wake_time' | 'wake_window_min' | 'day_start_hour' | 'notifications' | 'quiet_hours'
  >;
  startDay: DayString | null;
  habits: readonly Habit[];
  /** Today's quest instances (later days have none yet). */
  todayInstances: readonly Pick<
    QuestInstance,
    'id' | 'source_type' | 'source_id' | 'status' | 'core_snapshot'
  >[];
  /** Today's daily check-in is already saved. */
  checkInDone: boolean;
}

/** The core-quest reminder's time: early evening, while there's still time to do a minimum. */
export const REMINDER_TIME = '18:00';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function addMinutes(hhmm: string, minutes: number): string {
  const t = (parseTime(hhmm) + minutes) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** True if the instant falls inside quiet hours (which may run past midnight). */
export function inQuietHours(at: number, quiet: Settings['quiet_hours'], tz: string): boolean {
  const p = localParts(at, tz);
  return minuteInQuietHours(p.hour * 60 + p.minute, quiet);
}

/** True if a clock time (minutes after midnight, or "HH:MM") falls inside quiet hours. */
export function minuteInQuietHours(time: number | string, quiet: Settings['quiet_hours']): boolean {
  if (!quiet) return false;
  const m = typeof time === 'string' ? parseTime(time) : time;
  const start = parseTime(quiet.start);
  const end = parseTime(quiet.end);
  if (start === end) return false;
  return start < end ? m >= start && m < end : m >= start || m < end;
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
  const n = settings.notifications;
  const at = (day: DayString, hhmm: string) => appInstant(day, hhmm, tz, settings.day_start_hour);
  const daily = (day: DayString) =>
    input.habits.filter((h) => h.status === 'active' && !h.deleted_at && isScheduled(h, day));
  const todayDaily = input.todayInstances.filter(
    (i) => i.source_type === 'habit' && !isRecoveryId(i.id),
  );

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

    // Morning briefing (SPEC 6.1): when the wake-up window ends.
    if (n.morning_briefing) {
      const count =
        k === 0 ? todayDaily.filter((i) => !isDone(i.status)).length : daily(day).length;
      const core =
        k === 0
          ? todayDaily.filter((i) => i.core_snapshot && !isDone(i.status)).length
          : day === startDay
            ? 0
            : daily(day).filter((h) => h.core).length;
      if (count > 0) {
        list.push({
          key: `briefing:${day}`,
          kind: 'briefing',
          at: at(day, addMinutes(settings.wake_time, settings.wake_window_min)),
          day,
          title: `Day ${dayN}. ${plural(count, 'quest')} today.`,
          body: core > 0 ? `${core} core. Start with the smallest.` : 'Start with the smallest.',
          path: '/',
        });
      }
    }

    // Core-quest reminder: only while core quests are still open (Day 1 has none).
    if (n.quest_reminders && day !== startDay) {
      const open =
        k === 0
          ? todayDaily.filter((i) => i.core_snapshot && !isDone(i.status)).length
          : daily(day).filter((h) => h.core).length;
      if (open > 0) {
        list.push({
          key: `reminder:${day}`,
          kind: 'reminder',
          at: at(day, REMINDER_TIME),
          day,
          title: k === 0 ? `${plural(open, 'core quest')} still open.` : 'Core quests still open?',
          body: 'The minimum versions count — they keep the day active.',
          path: '/',
        });
      }
    }

    // Evening wind-down: the 1-minute check-in.
    if (n.evening_winddown && !(k === 0 && input.checkInDone)) {
      list.push({
        key: `winddown:${day}`,
        kind: 'winddown',
        at: at(day, n.evening_time),
        day,
        title: 'Time to wind down.',
        body: 'How did today go? The check-in takes a minute.',
        path: '/review',
      });
    }
  }

  // Away for a week (SPEC 7): everything above lies within 7 days of the last time ASCEND was
  // opened, so if it isn't opened again, reminders simply stop — except this one gentle note.
  const anyOn = n.wake_checkin || n.morning_briefing || n.quest_reminders || n.evening_winddown;
  if (anyOn) {
    const day = addDays(input.today, DAYS_AHEAD);
    list.push({
      key: `welcome_back:${day}`,
      kind: 'welcome_back',
      at: at(day, addMinutes(settings.wake_time, settings.wake_window_min + 60)),
      day,
      title: 'No pressure.',
      body: 'Your quests are here whenever you’re ready. Reminders resume when you open ASCEND.',
      path: '/',
    });
  }

  return (
    list
      .filter((x) => x.at > input.now)
      // Quiet hours hold everything except the wake-up check-in you asked to be woken by.
      .filter((x) => x.kind === 'wake' || !inQuietHours(x.at, settings.quiet_hours, tz))
      .sort((a, b) => a.at - b.at)
  );
}
