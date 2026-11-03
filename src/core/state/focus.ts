import { loadExpanded } from '@/core/compaction/expanded';
import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { FocusSession, Stat } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** The running focus session (if any) and all past sessions, newest first. */
export interface FocusState {
  status: 'loading' | 'ready';
  running: FocusSession | null;
  sessions: FocusSession[];
  /** Title and stat of each linked quest (by instance id). */
  linked: Record<string, { title: string; stat: Stat }>;
}

export const focusStore = createStore<FocusState>(() => ({
  status: 'loading',
  running: null,
  sessions: [],
  linked: {},
}));

export function useFocus<T>(selector: (state: FocusState) => T): T {
  return useStore(focusStore, selector);
}

export async function loadFocus(database: AscendDB = defaultDb): Promise<void> {
  try {
    const all = [
      ...(await database.focus_sessions.toArray()),
      ...(await loadExpanded(database)).sessions,
    ]
      .filter((s) => s.deleted_at === null)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    const ids = [
      ...new Set(all.flatMap((s) => (s.quest_instance_id ? [s.quest_instance_id] : []))),
    ];
    const instances = await database.quest_instances.bulkGet(ids);
    const linked = Object.fromEntries(
      instances.flatMap((i) =>
        i ? [[i.id, { title: i.title_snapshot, stat: i.stat_snapshot }] as const] : [],
      ),
    );
    focusStore.setState({
      status: 'ready',
      running: all.find((s) => s.ended_at === null) ?? null,
      sessions: all.filter((s) => s.ended_at !== null),
      linked,
    });
  } catch (error) {
    logError(error, 'focus.load');
  }
}

export async function startFocusStore(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadFocus(database));
  await loadFocus(database);
  return unsubscribe;
}
