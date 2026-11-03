import { z } from 'zod';
import type { AscendDB } from '@/core/db/db';
import type { DayString, IsoTime, QuestInstance } from '@/core/db/types';
import { evaluateDay } from '@/core/engine/dayEval';
import { refreshDayRecord } from '../days';
import { touch } from '../records';
import { defineAction } from '../registry';
import { refreshStreaks } from '../streaks';

/** Bump when the rules behind the stored day fields change, to force a full rebuild. */
export const DERIVED_VERSION = 1;

export interface RebuildResult {
  daysChecked: number;
  /** Day records whose stored fields disagreed with their quests and were corrected. */
  daysFixed: number;
}

/**
 * Consistency check + "Rebuild progress" (PLAN: derived state is recomputable). The only
 * derived values stored are the `days` fields; everything else (level, stats, rank) is always
 * computed from xp_events. This re-evaluates every day from its quest instances, recomputes
 * all streaks, and writes only what was wrong. Runs at every startup and from Settings.
 */
export const rebuildProgress = defineAction({
  type: 'progress.rebuild',
  schema: z.object({}).strict(),
  tables: ['days', 'quest_instances', 'settings'],
  run: (ctx) => rebuildDays(ctx.db, ctx.processedAt),
});

/** Re-evaluates every day and recomputes streaks (inside the caller's transaction). */
export async function rebuildDays(db: AscendDB, processedAt: IsoTime): Promise<RebuildResult> {
  const records = new Map((await db.days.toArray()).map((d) => [d.day, d]));
  const byDay = new Map<DayString, QuestInstance[]>();
  for (const instance of await db.quest_instances.toArray()) {
    const list = byDay.get(instance.day) ?? [];
    list.push(instance);
    byDay.set(instance.day, list);
  }

  const fixed = new Set<DayString>();
  const allDays = [...new Set([...records.keys(), ...byDay.keys()])].sort();
  for (const day of allDays) {
    const record = records.get(day);
    if (!record) {
      // Quests without a day record (e.g. after an import): create it.
      await refreshDayRecord(db, day, processedAt, {}, { deferStreaks: true });
      fixed.add(day);
      continue;
    }
    if (record.deleted_at !== null) continue;
    const e = evaluateDay(byDay.get(day) ?? [], record.low_energy);
    if (
      record.active !== e.active ||
      record.neutral !== e.neutral ||
      record.daily_clear !== e.dailyClear
    ) {
      await db.days.put({
        ...record,
        active: e.active,
        neutral: e.neutral,
        daily_clear: e.dailyClear,
        ...touch(processedAt),
      });
      fixed.add(day);
    }
  }

  const before = new Map((await db.days.toArray()).map((d) => [d.day, d.hlc]));
  await refreshStreaks(db, processedAt);
  for (const d of await db.days.toArray()) if (before.get(d.day) !== d.hlc) fixed.add(d.day);

  await db.meta.put({ id: 'derived_version', value: DERIVED_VERSION });
  return { daysChecked: allDays.length, daysFixed: fixed.size };
}
