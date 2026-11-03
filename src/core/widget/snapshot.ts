import type { DayString, QuestInstance, Settings } from '@/core/db/types';
import { isDone } from '@/core/engine/progress';
import { addDays, dayNumber, instantAt } from '@/core/time';

/**
 * The "today snapshot" for the Android home-screen widgets (SPEC 6.4, task 10.2). A widget is
 * native code and can't read the app's database, so the app writes this small JSON whenever
 * something changes; the widget only draws it. Taps on the widget go into a native queue that
 * the app runs through the normal pipeline (task 10.3).
 */
export const SNAPSHOT_VERSION = 1;
/** Rows a widget can show. */
export const WIDGET_ROWS = 4;

export type WidgetQuestKind = 'check' | 'wake' | 'open';

export interface WidgetQuest {
  /** Quest instance id (what a tap completes). */
  id: string;
  title: string;
  /** check: one tap = Full · wake: "I'm up" · open: needs numbers, so the tap opens ASCEND. */
  kind: WidgetQuestKind;
  done: boolean;
  /** Short status, e.g. "45 / 150 min" or "Done". */
  detail: string;
}

export interface WidgetSnapshot {
  v: number;
  day: DayString;
  /** After this instant (the next day-start) the widget says "Open ASCEND to start today". */
  validUntil: number;
  /** "Day 214" (or "" before Day 1). */
  dayLabel: string;
  level: number;
  xpLabel: string;
  /** 0–100, progress to the next level. */
  progress: number;
  streak: number;
  /** Open first, then done; at most WIDGET_ROWS. */
  quests: WidgetQuest[];
  /** Total quests today and how many are done (the widget's "3 / 8 done"). */
  total: number;
  doneCount: number;
  /** The wake-up "I'm up" button stops counting after this instant (the late cutoff). */
  wakeUntil: number | null;
}

export interface SnapshotInput {
  day: DayString;
  tz: string;
  settings: Pick<Settings, 'day_start_hour' | 'wake_late_cutoff'>;
  startDay: DayString | null;
  level: { level: number; xpIntoLevel: number; xpForNext: number; progress: number };
  streak: number;
  lowEnergy: boolean;
  quests: readonly { instance: QuestInstance; progress: number }[];
}

const UNIT: Record<string, string> = { minutes: ' min', steps: '', sleep_hours: ' h', count: '' };

function detailOf(i: QuestInstance, progress: number): string {
  if (isDone(i.status)) return i.status === 'done_min' ? 'Minimum' : 'Done';
  if (i.measure_snapshot === 'check') return i.core_snapshot ? 'Core' : '';
  const unit = UNIT[i.measure_snapshot] ?? '';
  const value = i.measure_snapshot === 'steps' ? progress.toLocaleString('en') : progress;
  const target =
    i.measure_snapshot === 'steps'
      ? (i.target_snapshot ?? 0).toLocaleString('en')
      : (i.target_snapshot ?? 0);
  return `${value} / ${target}${unit}`;
}

export function buildSnapshot(input: SnapshotInput): WidgetSnapshot {
  const hh = `${String(input.settings.day_start_hour).padStart(2, '0')}:00`;
  // Low energy hides non-core quests that aren't done, like Today does.
  const visible = input.quests.filter(
    (q) => !input.lowEnergy || q.instance.core_snapshot || isDone(q.instance.status),
  );
  const rows: WidgetQuest[] = visible.map(({ instance: i, progress }) => ({
    id: i.id,
    title: i.title_snapshot,
    kind:
      i.auto_source_snapshot === 'wake_checkin'
        ? 'wake'
        : i.measure_snapshot === 'check' && i.auto_source_snapshot !== 'screen_time'
          ? 'check'
          : 'open',
    done: isDone(i.status),
    detail: detailOf(i, progress),
  }));
  const ordered = [...rows.filter((r) => !r.done), ...rows.filter((r) => r.done)];
  const hasWake = rows.some((r) => r.kind === 'wake' && !r.done);
  return {
    v: SNAPSHOT_VERSION,
    day: input.day,
    validUntil: instantAt(addDays(input.day, 1), hh, input.tz),
    dayLabel:
      input.startDay && input.day >= input.startDay
        ? `Day ${dayNumber(input.startDay, input.day)}`
        : '',
    level: input.level.level,
    xpLabel: `${input.level.xpIntoLevel.toLocaleString('en')} / ${input.level.xpForNext.toLocaleString('en')} XP`,
    progress: Math.round(Math.min(1, Math.max(0, input.level.progress)) * 100),
    streak: input.streak,
    quests: ordered.slice(0, WIDGET_ROWS),
    total: rows.length,
    doneCount: rows.filter((r) => r.done).length,
    wakeUntil: hasWake ? instantAt(input.day, input.settings.wake_late_cutoff, input.tz) : null,
  };
}
