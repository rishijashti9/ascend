import type { AscendDB } from '@/core/db/db';
import { progressValue } from '@/core/engine/progress';
import { appDayOf, getSettings } from '@/core/pipeline/helpers';
import { isoNow } from '@/core/pipeline/records';
import { addDays } from '@/core/time';
import type { AdaptiveInput, InstanceObs } from './input';
import { ADAPTIVE } from './model';

/** Reads the Adaptive System's input from the database (last `windowDays`). */
export async function loadAdaptiveInput(
  db: AscendDB,
  tz: string,
  windowDays: number = ADAPTIVE.windowDays,
): Promise<AdaptiveInput> {
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
      const from = addDays(today, -windowDays);
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
          wake: i.auto_source_snapshot === 'wake_checkin',
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
          .map((f) => ({
            day: f.day,
            startedAt: f.started_at,
            minutes: f.actual_min,
            linked: f.quest_instance_id !== null,
          })),
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
