import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { FocusSession } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** The running focus session (if any) and all past sessions, newest first. */
export interface FocusState {
  status: 'loading' | 'ready';
  running: FocusSession | null;
  sessions: FocusSession[];
}

export const focusStore = createStore<FocusState>(() => ({
  status: 'loading',
  running: null,
  sessions: [],
}));

export function useFocus<T>(selector: (state: FocusState) => T): T {
  return useStore(focusStore, selector);
}

export async function loadFocus(database: AscendDB = defaultDb): Promise<void> {
  try {
    const all = (await database.focus_sessions.toArray())
      .filter((s) => s.deleted_at === null)
      .sort((a, b) => b.started_at.localeCompare(a.started_at));
    focusStore.setState({
      status: 'ready',
      running: all.find((s) => s.ended_at === null) ?? null,
      sessions: all.filter((s) => s.ended_at !== null),
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
