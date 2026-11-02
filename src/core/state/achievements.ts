import { createStore, useStore } from 'zustand';
import { FACT_TABLES, readFacts } from '@/core/achievements/facts';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { AchievementUnlocked } from '@/core/db/types';
import type { AchievementFacts } from '@/core/engine/achievements';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** Unlocked achievements (by key) and the current facts, for progress toward locked ones. */
export interface AchievementsState {
  status: 'loading' | 'ready';
  unlocked: Record<string, AchievementUnlocked>;
  facts: AchievementFacts | null;
}

export const achievementsStore = createStore<AchievementsState>(() => ({
  status: 'loading',
  unlocked: {},
  facts: null,
}));

export function useAchievements<T>(selector: (state: AchievementsState) => T): T {
  return useStore(achievementsStore, selector);
}

export async function loadAchievements(database: AscendDB = defaultDb): Promise<void> {
  try {
    const [rows, facts] = await database.transaction(
      'r',
      [...FACT_TABLES, 'achievements_unlocked'],
      async () =>
        [await database.achievements_unlocked.toArray(), await readFacts(database)] as const,
    );
    achievementsStore.setState({
      status: 'ready',
      unlocked: Object.fromEntries(
        rows.filter((r) => r.deleted_at === null).map((r) => [r.achievement_key, r]),
      ),
      facts,
    });
  } catch (error) {
    logError(error, 'achievements.load');
  }
}

export async function startAchievementsStore(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadAchievements(database));
  await loadAchievements(database);
  return unsubscribe;
}
