import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { computeProgress, type ProgressState } from '@/core/engine/progressState';
import { logError } from '@/core/errorLog';
import { appDayOf, isoNow, recordAction, subscribeAll, type RebuildResult } from '@/core/pipeline';

/**
 * Derived-state store (PLAN 1: "progress engine … cached in Zustand"). Screens read level,
 * XP, stats, rank and streaks from here and never compute or write them. It reloads from the
 * database after every committed action (events), so it can't drift from the stored data.
 */
export interface ProgressStoreState {
  status: 'loading' | 'ready' | 'error';
  progress: ProgressState | null;
  error: string | null;
}

export const progressStore = createStore<ProgressStoreState>(() => ({
  status: 'loading',
  progress: null,
  error: null,
}));

/** React hook: `const level = useProgress((s) => s.progress?.level)`. */
export function useProgress<T>(selector: (state: ProgressStoreState) => T): T {
  return useStore(progressStore, selector);
}

/** Recomputes progress from the database (days, xp_events, quest_instances). */
export async function loadProgress(database: AscendDB = defaultDb): Promise<ProgressState> {
  try {
    const [days, xpEvents, instances, today] = await database.transaction(
      'r',
      ['days', 'xp_events', 'quest_instances', 'settings'],
      () =>
        Promise.all([
          database.days.toArray(),
          database.xp_events.toArray(),
          database.quest_instances.toArray(),
          appDayOf(database, isoNow()),
        ]),
    );
    const progress = computeProgress({ days, xpEvents, instances, today });
    progressStore.setState({ status: 'ready', progress, error: null });
    return progress;
  } catch (error) {
    logError(error, 'progress.load');
    progressStore.setState({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** Reloads after changes; many events in a row cause at most one extra reload. */
function reloader(database: AscendDB): () => Promise<void> {
  let running = false;
  let again = false;
  return async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        await loadProgress(database).catch(() => undefined);
      } while (again);
    } finally {
      running = false;
    }
  };
}

/** Initial load, then keeps the store current. Returns a stop function. */
export async function startProgressStore(database: AscendDB = defaultDb): Promise<() => void> {
  const reload = reloader(database);
  const unsubscribe = subscribeAll(() => reload());
  await reload();
  return unsubscribe;
}

/**
 * Startup consistency check and the Settings "Rebuild progress" button: re-checks every
 * stored day against its quests, fixes what's wrong, then reloads the store.
 */
export async function rebuildProgress(database: AscendDB = defaultDb): Promise<RebuildResult> {
  const result = await recordAction<RebuildResult>(
    { type: 'progress.rebuild', payload: {} },
    { db: database },
  );
  await loadProgress(database);
  return result.value ?? { daysChecked: 0, daysFixed: 0 };
}
