import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { DayString, Quest, QuestInstance } from '@/core/db/types';
import { progressValue } from '@/core/engine/progress';
import { logError } from '@/core/errorLog';
import { appDayOf, isoNow, subscribeAll } from '@/core/pipeline';
import { currentTimeZone, dayOf, weekStartOf } from '@/core/time';

/** One quest card on Today: the instance plus its current numeric progress. */
export interface TodayQuest {
  instance: QuestInstance;
  /** Sum (minutes/count) or latest total (steps/sleep); 0 for check quests. */
  progress: number;
  /** For weekly/side/recovery quests: the quest record (e.g. which day a Recovery quest repairs). */
  quest: Quest | null;
}

export interface TodayState {
  status: 'loading' | 'ready';
  day: DayString | null;
  /** Daily quests in the order Rishi set. */
  daily: TodayQuest[];
  /** Today's Recovery quest (if any). */
  other: TodayQuest[];
  /** This week's weekly quests. */
  week: TodayQuest[];
  /** Open side quests (and ones finished today). */
  side: TodayQuest[];
  lowEnergy: boolean;
}

export const todayStore = createStore<TodayState>(() => ({
  status: 'loading',
  day: null,
  daily: [],
  other: [],
  week: [],
  side: [],
  lowEnergy: false,
}));

export function useToday<T>(selector: (state: TodayState) => T): T {
  return useStore(todayStore, selector);
}

export async function loadToday(database: AscendDB = defaultDb): Promise<void> {
  try {
    const state = await database.transaction(
      'r',
      ['settings', 'quest_instances', 'progress_entries', 'habits', 'quests', 'days'],
      async () => {
        const day = await appDayOf(database, isoNow());
        const settings = await database.settings.get('settings');
        const weekStart = weekStartOf(day, settings?.week_start ?? 1);
        const todays = await database.quest_instances.where('day').equals(day).toArray();
        const weekly =
          weekStart === day
            ? []
            : await database.quest_instances.where('day').equals(weekStart).toArray();
        const sideQuests = (await database.quests.where('type').equals('side').toArray()).filter(
          (q) => q.deleted_at === null && (q.status === 'active' || q.status === 'done'),
        );
        const sideInstances = (
          await database.quest_instances.bulkGet(sideQuests.map((q) => q.id))
        ).filter((i): i is QuestInstance => i !== undefined);
        const instances = [
          ...new Map(
            [...todays, ...weekly, ...sideInstances]
              .filter((i) => i.deleted_at === null)
              .map((i) => [i.id, i] as const),
          ).values(),
        ];
        const entries = await database.progress_entries
          .where('quest_instance_id')
          .anyOf(instances.map((i) => i.id))
          .toArray();
        const habits = await database.habits.bulkGet(
          instances.filter((i) => i.source_type === 'habit').map((i) => i.source_id),
        );
        const quests = await database.quests.bulkGet(
          instances.filter((i) => i.source_type === 'quest').map((i) => i.source_id),
        );
        const questById = new Map(quests.flatMap((q) => (q ? [[q.id, q] as const] : [])));
        const dayRecord = await database.days.get(day);
        const order = new Map(habits.flatMap((h) => (h ? [[h.id, h.order] as const] : [])));
        const toQuest = (instance: QuestInstance): TodayQuest => ({
          instance,
          progress: progressValue(
            instance.measure_snapshot,
            entries.filter((e) => e.quest_instance_id === instance.id),
          ),
          quest:
            instance.source_type === 'quest' ? (questById.get(instance.source_id) ?? null) : null,
        });
        const daily = instances
          .filter((i) => i.source_type === 'habit' && i.day === day)
          .sort((a, b) => (order.get(a.source_id) ?? 0) - (order.get(b.source_id) ?? 0))
          .map(toQuest);
        const ofType = (type: string) =>
          instances
            .filter((i) => i.source_type === 'quest' && questById.get(i.source_id)?.type === type)
            .map(toQuest);
        // Finished side quests stay visible for the rest of the day they were done.
        const doneEarlier = (q: TodayQuest) =>
          q.instance.completed_at !== null &&
          dayOf(
            Date.parse(q.instance.completed_at),
            currentTimeZone(),
            settings?.day_start_hour ?? 3,
          ) < day;
        const other = ofType('recovery').filter((q) => q.instance.day === day);
        const week = ofType('weekly').filter((q) => q.instance.day === weekStart);
        const side = ofType('side').filter(
          (q) => q.instance.status === 'pending' || !doneEarlier(q),
        );
        return {
          status: 'ready' as const,
          day,
          daily,
          other,
          week,
          side,
          lowEnergy: dayRecord?.low_energy ?? false,
        };
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
