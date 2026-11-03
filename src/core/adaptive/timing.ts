import type { Settings } from '@/core/db/types';
import { minuteInQuietHours, reminderTimeOf } from '@/core/notifications/plan';
import { parseTime } from '@/core/time';
import type { AdaptiveInput } from './input';
import { completionWindow, type HourWindow } from './patterns';

/**
 * Learned reminder timing (SPEC 6.7 A). The core-quest reminder only fires while core quests
 * are still open; if they're usually finished clearly later than it fires, it nags before the
 * time you'd act anyway — so the System suggests moving it to half an hour before then.
 * Only "later" is ever suggested: an earlier finish means the reminder rarely fires at all.
 */
export interface ReminderSuggestion {
  from: string;
  to: string;
  window: HourWindow;
  /** e.g. "You usually finish your core quests between 19:00 and 21:00." */
  why: string;
}

/** The window must start at least this many minutes after the current reminder. */
const MIN_SHIFT_MIN = 90;

const hhmm = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function reminderSuggestion(
  input: AdaptiveInput,
  settings: Pick<Settings, 'notifications' | 'quiet_hours' | 'wake_time'>,
): ReminderSuggestion | null {
  if (!settings.notifications.quest_reminders) return null;
  const window = completionWindow(input, true);
  if (!window || window.confidence === 'early') return null;
  const from = reminderTimeOf(settings);
  const start = window.start * 60;
  const current = parseTime(from);
  // Times after midnight but before waking belong to the evening before.
  const wake = parseTime(settings.wake_time);
  const startMin = start < wake ? start + 24 * 60 : start;
  if (startMin - current < MIN_SHIFT_MIN || startMin >= 24 * 60) return null;
  const to = hhmm(startMin - 30);
  if (minuteInQuietHours(to, settings.quiet_hours)) return null;
  return {
    from,
    to,
    window,
    why: `You usually finish your core quests between ${hhmm(start)} and ${hhmm(start + window.hours * 60)}.`,
  };
}
