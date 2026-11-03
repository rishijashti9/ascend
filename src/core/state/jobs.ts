import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import type { JobApplication } from '@/core/db/types';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';

/** Job applications (Jobs screen, stats, follow-ups), most recently changed first. */
export interface JobsState {
  status: 'loading' | 'ready';
  jobs: JobApplication[];
  /** Job-stats suggestions hidden until a day, by kind (this device only). */
  snoozed: Record<string, string>;
}

export const jobsStore = createStore<JobsState>(() => ({
  status: 'loading',
  jobs: [],
  snoozed: {},
}));

export function useJobs<T>(selector: (state: JobsState) => T): T {
  return useStore(jobsStore, selector);
}

export async function loadJobs(database: AscendDB = defaultDb): Promise<void> {
  try {
    const jobs = (await database.job_applications.toArray())
      .filter((j) => j.deleted_at === null)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const snoozed: Record<string, string> = {};
    for (const m of await database.meta
      .where('id')
      .startsWith('job_suggestion_snooze:')
      .toArray()) {
      if (typeof m.value === 'string') snoozed[m.id.split(':')[1] ?? ''] = m.value;
    }
    jobsStore.setState({ status: 'ready', jobs, snoozed });
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
