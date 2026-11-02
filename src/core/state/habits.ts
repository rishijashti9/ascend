import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { Habit } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** Every habit that isn't permanently deleted, in Rishi's order (Quests screen). */
export interface HabitsState {
  status: 'loading' | 'ready';
  habits: Habit[];
}

export const habitsStore = createStore<HabitsState>(() => ({ status: 'loading', habits: [] }));

export function useHabits<T>(selector: (state: HabitsState) => T): T {
  return useStore(habitsStore, selector);
}

export async function loadHabits(database: AscendDB = defaultDb): Promise<void> {
  try {
    const habits = (await database.habits.toArray())
      .filter((h) => h.deleted_at === null)
      .sort((a, b) => a.order - b.order);
    habitsStore.setState({ status: 'ready', habits });
  } catch (error) {
    logError(error, 'habits.load');
  }
}

/** Initial load, then reload after every action. */
export async function startHabits(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadHabits(database));
  await loadHabits(database);
  return unsubscribe;
}
