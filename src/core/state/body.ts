import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { BodyLog, Photo } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** Body logs, newest day first (Body screen, charts, metric milestones). */
export interface BodyState {
  status: 'loading' | 'ready';
  logs: BodyLog[];
  /** Body photos (this device only), newest day first. */
  photos: Photo[];
}

export const bodyStore = createStore<BodyState>(() => ({
  status: 'loading',
  logs: [],
  photos: [],
}));

export function useBody<T>(selector: (state: BodyState) => T): T {
  return useStore(bodyStore, selector);
}

export async function loadBody(database: AscendDB = defaultDb): Promise<void> {
  try {
    const logs = (await database.body_logs.toArray())
      .filter((l) => l.deleted_at === null)
      .sort((a, b) => b.day.localeCompare(a.day));
    const photos = (await database.photos.toArray()).sort((a, b) => b.day.localeCompare(a.day));
    bodyStore.setState({ status: 'ready', logs, photos });
  } catch (error) {
    logError(error, 'body.load');
  }
}

export async function startBody(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll(() => loadBody(database));
  await loadBody(database);
  return unsubscribe;
}
