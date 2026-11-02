import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { DayString, QuestInstance } from '@/core/db/types';
import { progressValue } from '@/core/engine/progress';
import { logError } from '@/core/errorLog';
import { appDayOf, isoNow, subscribeAll } from '@/core/pipeline';

/** One quest card on Today: the instance plus its current numeric progress. */
export interface TodayQuest {
  instance: QuestInstance;
  /** Sum (minutes/count) or latest total (steps/sleep); 0 for check quests. */
  progress: number;
}

export interface TodayState {
  status: 'loading' | 'ready';
  day: DayString | null;
  /** Daily quests in the order Rishi set. */
  daily: TodayQuest[];
  /** Weekly, side and recovery quests due today. */
  other: TodayQuest[];
}

export const todayStore = createStore<TodayState>(() => ({
  status: 'loading',
  day: null,
  daily: [],
  other: [],
}));

export function useToday<T>(selector: (state: TodayState) => T): T {
  return useStore(todayStore, selector);
}

export async function loadToday(database: AscendDB = defaultDb): Promise<void> {
  try {
    const state = await database.transaction(
      'r',
      ['settings', 'quest_instances', 'progress_entries', 'habits'],
      async () => {
        const day = await appDayOf(database, isoNow());
        const instances = (
          await database.quest_instances.where('day').equals(day).toArray()
        ).filter((i) => i.deleted_at === null);
        const entries = await database.progress_entries
          .where('quest_instance_id')
          .anyOf(instances.map((i) => i.id))
          .toArray();
        const habits = await database.habits.bulkGet(
          instances.filter((i) => i.source_type === 'habit').map((i) => i.source_id),
        );
        const order = new Map(habits.flatMap((h) => (h ? [[h.id, h.order] as const] : [])));
        const toQuest = (instance: QuestInstance): TodayQuest => ({
          instance,
          progress: progressValue(
            instance.measure_snapshot,
            entries.filter((e) => e.quest_instance_id === instance.id),
          ),
        });
        const daily = instances
          .filter((i) => i.source_type === 'habit')
          .sort((a, b) => (order.get(a.source_id) ?? 0) - (order.get(b.source_id) ?? 0))
          .map(toQuest);
        const other = instances.filter((i) => i.source_type === 'quest').map(toQuest);
        return { status: 'ready' as const, day, daily, other };
      },
    );
    todayStore.setState(state);
  } catch (error) {
    logError(error, 'today.load');
  }
}

/** Initial load, then reload after every action (completions, rollover, habit edits). */
export async function startToday(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadToday(database));
  await loadToday(database);
  return unsubscribe;
}
