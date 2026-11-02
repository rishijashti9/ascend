import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { Moment } from '@/core/engine/moments';
import { logError } from '@/core/errorLog';
import { recordAction, subscribe } from '@/core/pipeline';
import { progressStore } from './progress';

/** Moments waiting to be shown (oldest first). */
export interface MomentsState {
  queue: Moment[];
}

export const momentsStore = createStore<MomentsState>(() => ({ queue: [] }));

export function useMoments<T>(selector: (state: MomentsState) => T): T {
  return useStore(momentsStore, selector);
}

export function dismissMoment(): void {
  momentsStore.setState((s) => ({ queue: s.queue.slice(1) }));
}

/**
 * Watches progress: whenever it changes, records it (moments.record) and queues the moment it
 * returns. After an import or reset the next record is silent — restored levels aren't new.
 */
export function startMoments(database: AscendDB = defaultDb): () => void {
  let silent = false;
  let chain = Promise.resolve();
  const record = () => {
    const progress = progressStore.getState().progress;
    if (!progress) return;
    const payload = {
      level: progress.level.level,
      rank: progress.rank,
      stats: {
        STR: progress.stats.STR.level,
        INT: progress.stats.INT.level,
        WIL: progress.stats.WIL.level,
      },
      silent,
    };
    silent = false;
    chain = chain.then(async () => {
      try {
        const { value } = await recordAction<Moment | null>(
          { type: 'moments.record', source: 'system', payload },
          { db: database },
        );
        if (value) momentsStore.setState((s) => ({ queue: [...s.queue, value] }));
      } catch (error) {
        logError(error, 'moments.record');
      }
    });
  };
  const offImport = subscribe('DataImported', () => {
    silent = true;
  });
  const offReset = subscribe('DataReset', () => {
    silent = true;
  });
  const offProgress = progressStore.subscribe((state, prev) => {
    if (state.progress !== prev.progress) record();
  });
  record();
  return () => {
    offImport();
    offReset();
    offProgress();
  };
}
