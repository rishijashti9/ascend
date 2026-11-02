import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { Profile, Settings } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** Profile and settings for screens (read-only; changes go through recordAction). */
export interface AppState {
  status: 'loading' | 'ready';
  profile: Profile | null;
  settings: Settings | null;
}

export const appStore = createStore<AppState>(() => ({
  status: 'loading',
  profile: null,
  settings: null,
}));

export function useAppState<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

export async function loadAppState(database: AscendDB = defaultDb): Promise<void> {
  try {
    const [profile, settings] = await Promise.all([
      database.profile.get('profile'),
      database.settings.get('settings'),
    ]);
    appStore.setState({ status: 'ready', profile: profile ?? null, settings: settings ?? null });
  } catch (error) {
    logError(error, 'app-state.load');
  }
}

/** Initial load, then reload after every action. Returns a stop function. */
export async function startAppState(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadAppState(database));
  await loadAppState(database);
  return unsubscribe;
}
