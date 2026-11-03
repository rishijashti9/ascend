import type { AscendDB } from '@/core/db/db';
import type {
  Habit,
  InstanceStatus,
  LearningEvent,
  Measure,
  Settings,
  Stat,
} from '@/core/db/types';
import { progressValue } from '@/core/engine/progress';
import { appDayOf, getSettings, isoNow } from '@/core/pipeline';
import { addDays, type DayString } from '@/core/time';
import { ADAPTIVE } from './model';

/**
 * Everything the Adaptive System reads (SPEC 6.7 A) — numbers and patterns only, never
 * journal text. Built once from the database (last WINDOW_DAYS), then every model is pure.
 */
export interface InstanceObs {
  id: string;
  habitId: string;
  day: DayString;
  status: InstanceStatus;
  measure: Measure;
  target: number | null;
  min: number | null;
  /** Logged amount for numeric quests (minutes, count, steps, sleep hours). */
  value: number | null;
  completedAt: string | null;
  core: boolean;
  lowEnergy: boolean;
  stat: Stat;
}

export interface FocusObs {
  day: DayString;
  startedAt: string;
  minutes: number;
}

export interface AdaptiveInput {
  today: DayString;
  tz: string;
  settings: Settings;
  startDay: DayString | null;
  habits: Habit[];
  /** Daily-quest instances of closed and current days within the window, oldest first. */
  instances: InstanceObs[];
  focus: FocusObs[];
  sleep: { day: DayString; value: number }[];
  weight: { day: DayString; value: number }[];
  /** Daily check-in energy (1–5) — used on-device only, never sent anywhere. */
  energy: { day: DayString; value: number }[];
  mood: { day: DayString; value: number }[];
  lowEnergyDays: DayString[];
  /** Learning events within the window (suggestions, notifications, weeks, resets, forgets). */
  events: LearningEvent[];
}

/** Day from which a habit's data counts (latest reset of that habit or of everything). */
export function learnFrom(events: readonly LearningEvent[], habitId: string | null): DayString {
  let from = '';
  for (const e of events) {
    if (e.kind !== 'reset' || e.deleted_at) continue;
    if (e.ref_id === null || e.ref_id === habitId) if (e.day > from) from = e.day;
  }
  return from;
}

/** Item keys cleared on "What the System knows about you" (with the day they were cleared). */
export function forgotten(events: readonly LearningEvent[]): Map<string, DayString> {
  const map = new Map<string, DayString>();
  for (const e of events) {
    if (e.kind === 'forget' && !e.deleted_at && (map.get(e.type) ?? '') < e.day)
      map.set(e.type, e.day);
  }
  return map;
}

export async function loadAdaptiveInput(db: AscendDB, tz: string): Promise<AdaptiveInput> {
  return db.transaction(
    'r',
    [
      'settings',
      'profile',
      'habits',
      'quest_instances',
      'progress_entries',
      'days',
      'focus_sessions',
      'body_logs',
      'reviews',
      'learning_events',
    ],
    async () => {
      const settings = await getSettings(db);
      const today = await appDayOf(db, isoNow());
      const from = addDays(today, -ADAPTIVE.windowDays);
      const days = await db.days.where('id').between(from, today, true, true).toArray();
      const low = new Set(days.filter((d) => d.low_energy).map((d) => d.id));
      const raw = (
        await db.quest_instances.where('day').between(from, today, true, true).toArray()
      ).filter((i) => !i.deleted_at && i.source_type === 'habit');
      const numericIds = raw.filter((i) => i.measure_snapshot !== 'check').map((i) => i.id);
      const entries = numericIds.length
        ? await db.progress_entries.where('quest_instance_id').anyOf(numericIds).toArray()
        : [];
      const byInstance = new Map<string, typeof entries>();
      for (const e of entries) {
        const list = byInstance.get(e.quest_instance_id) ?? [];
        list.push(e);
        byInstance.set(e.quest_instance_id, list);
      }
      const instances: InstanceObs[] = raw
        .map((i) => ({
          id: i.id,
          habitId: i.source_id,
          day: i.day,
          status: i.status,
          measure: i.measure_snapshot,
          target: i.target_snapshot,
          min: i.min_snapshot,
          value:
            i.measure_snapshot === 'check'
              ? null
              : progressValue(i.measure_snapshot, byInstance.get(i.id) ?? []),
          completedAt: i.completed_at,
          core: i.core_snapshot,
          lowEnergy: low.has(i.day),
          stat: i.stat_snapshot,
        }))
        .sort((a, b) => a.day.localeCompare(b.day));
      const body = (
        await db.body_logs.where('day').between(from, today, true, true).toArray()
      ).filter((b) => !b.deleted_at);
      const reviews = (await db.reviews.where('type').equals('daily').toArray()).filter(
        (r) => !r.deleted_at && r.period >= from,
      );
      return {
        today,
        tz,
        settings,
        startDay: (await db.profile.get('profile'))?.start_day ?? null,
        habits: (await db.habits.toArray()).filter((h) => !h.deleted_at),
        instances,
        focus: (await db.focus_sessions.where('day').between(from, today, true, true).toArray())
          .filter((f) => !f.deleted_at && f.actual_min > 0)
          .map((f) => ({ day: f.day, startedAt: f.started_at, minutes: f.actual_min })),
        sleep: body.flatMap((b) => (b.sleep_hours ? [{ day: b.day, value: b.sleep_hours }] : [])),
        weight: body.flatMap((b) => (b.weight ? [{ day: b.day, value: b.weight }] : [])),
        energy: reviews.flatMap((r) => (r.energy ? [{ day: r.period, value: r.energy }] : [])),
        mood: reviews.flatMap((r) => (r.mood ? [{ day: r.period, value: r.mood }] : [])),
        lowEnergyDays: [...low].sort(),
        events: (
          await db.learning_events.where('day').between(from, today, true, true).toArray()
        ).filter((e) => !e.deleted_at),
      };
    },
  );
}
