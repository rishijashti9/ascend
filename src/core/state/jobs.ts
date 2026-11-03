import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { JobApplication } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** Job applications (Jobs screen, stats, follow-ups), most recently changed first. */
export interface JobsState {
  status: 'loading' | 'ready';
  jobs: JobApplication[];
}

export const jobsStore = createStore<JobsState>(() => ({ status: 'loading', jobs: [] }));

export function useJobs<T>(selector: (state: JobsState) => T): T {
  return useStore(jobsStore, selector);
}

export async function loadJobs(database: AscendDB = defaultDb): Promise<void> {
  try {
    const jobs = (await database.job_applications.toArray())
      .filter((j) => j.deleted_at === null)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    jobsStore.setState({ status: 'ready', jobs });
  } catch (error) {
    logError(error, 'jobs.load');
  }
}

export async function startJobs(database: AscendDB = defaultDb): Promise<() => void> {
  const unsubscribe = subscribeAll((event) => {
    if (['JobChanged', 'DataSynced', 'DataImported', 'DataReset'].includes(event.type)) {
      void loadJobs(database);
    }
  });
  await loadJobs(database);
  return unsubscribe;
}
