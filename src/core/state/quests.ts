import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { Quest } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** Weekly and side quests (Quests screen tabs). Recovery quests live on Today only. */
export interface QuestsState {
  status: 'loading' | 'ready';
  weekly: Quest[];
  side: Quest[];
}

export const questsStore = createStore<QuestsState>(() => ({
  status: 'loading',
  weekly: [],
  side: [],
}));

export function useQuests<T>(selector: (state: QuestsState) => T): T {
  return useStore(questsStore, selector);
}

export async function loadQuests(database: AscendDB = defaultDb): Promise<void> {
  try {
    const all = (await database.quests.toArray()).filter((q) => q.deleted_at === null);
    const byNewest = (a: Quest, b: Quest) => b.created_at.localeCompare(a.created_at);
    questsStore.setState({
      status: 'ready',
      weekly: all.filter((q) => q.type === 'weekly').sort(byNewest),
      side: all.filter((q) => q.type === 'side').sort(byNewest),
    });
  } catch (error) {
    logError(error, 'quests.load');
  }
}

export async function startQuests(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadQuests(database));
  await loadQuests(database);
  return unsubscribe;
}
