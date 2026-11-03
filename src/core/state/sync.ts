import { createStore, useStore } from 'zustand';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { subscribeAll } from '@/core/pipeline';
import { SyncUnavailable, type SyncBackend } from '@/core/sync/backend';
import { syncOnce } from '@/core/sync/engine';
import { connect, linkStatus, type LinkChoice } from '@/core/sync/link';
import { accountStore } from './account';

/** Sync status for the Account section and the quiet "Sync paused" note. */
export interface SyncState {
  status:
    'off' | 'checking' | 'needs_choice' | 'syncing' | 'synced' | 'paused' | 'offline' | 'error';
  lastSyncedAt: number | null;
  message: string | null;
}

export const syncStore = createStore<SyncState>(() => ({
  status: 'off',
  lastSyncedAt: null,
  message: null,
}));

export function useSync<T>(selector: (state: SyncState) => T): T {
  return useStore(syncStore, selector);
}

const AFTER_CHANGE_MS = 5000;
const EVERY_MS = 5 * 60_000;

export interface SyncRunner {
  /** Run a round now (no-op when signed out or waiting for the first-sign-in choice). */
  syncNow(): Promise<void>;
  /** First sign-in: answer the merge / keep / cloud question. */
  choose(choice: LinkChoice): Promise<void>;
  stop(): void;
}

let active: SyncRunner | null = null;
export const syncRunner = (): SyncRunner | null => active;

/**
 * Keeps this device in sync while signed in: at sign-in (with the first-sign-in check), a few
 * seconds after local changes, every 5 minutes, when the connection comes back and when the
 * app returns to the front. Never throws: problems become a status (SPEC 9: sync fails
 * gracefully and the app keeps working offline).
 */
export function startSync(
  makeBackend: () => SyncBackend | null,
  options: { database?: AscendDB; onLocalDataReplaced?: () => void } = {},
): SyncRunner {
  const database = options.database ?? defaultDb;
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fail = (error: unknown) => {
    if (error instanceof SyncUnavailable) {
      const status =
        error.reason === 'offline' ? 'offline' : error.reason === 'paused' ? 'paused' : 'error';
      syncStore.setState({
        status,
        message:
          error.reason === 'auth'
            ? 'Your sign-in has expired. Sign in again to keep syncing.'
            : null,
      });
    } else {
      logError(error, 'sync');
      syncStore.setState({ status: 'error', message: null });
    }
  };

  const round = async (choice?: LinkChoice) => {
    const userId = accountStore.getState().userId;
    const backend = makeBackend();
    if (!userId || !backend) {
      syncStore.setState({ status: 'off', message: null });
      return;
    }
    try {
      if (choice) {
        syncStore.setState({ status: 'syncing', message: null });
        await connect(database, backend, userId, choice);
        if (choice === 'use_cloud') options.onLocalDataReplaced?.();
      } else {
        const state = syncStore.getState().status;
        if (state === 'needs_choice') return;
        syncStore.setState({ status: state === 'synced' ? 'syncing' : 'checking', message: null });
        const link = await linkStatus(database, backend, userId);
        if (link === 'choose') {
          syncStore.setState({ status: 'needs_choice', message: null });
          return;
        }
        syncStore.setState({ status: 'syncing' });
        if (link === 'linked') await syncOnce(database, backend);
        else {
          await connect(database, backend, userId, link);
          if (link === 'download') options.onLocalDataReplaced?.();
        }
      }
      syncStore.setState({ status: 'synced', lastSyncedAt: Date.now(), message: null });
    } catch (error) {
      fail(error);
    }
  };

  const run = (choice?: LinkChoice): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = round(choice).finally(() => {
      running = null;
      if (again) {
        again = false;
        void run();
      }
    });
    return running;
  };

  const soon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void run(), AFTER_CHANGE_MS);
  };
  const offEvents = subscribeAll(() => {
    if (accountStore.getState().status === 'signed_in') soon();
  });
  let lastUser = accountStore.getState().userId;
  const offAccount = accountStore.subscribe((s) => {
    if (s.userId !== lastUser) {
      lastUser = s.userId;
      syncStore.setState({ status: s.userId ? 'checking' : 'off', message: null });
      if (s.userId) void run();
    }
  });
  const interval = setInterval(() => void run(), EVERY_MS);
  const onOnline = () => void run();
  const onVisible = () => {
    if (document.visibilityState === 'visible') void run();
  };
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  if (lastUser) void run();

  active = {
    syncNow: () => run(),
    choose: async (choice) => {
      syncStore.setState({ status: 'syncing' });
      await run(choice);
    },
    stop: () => {
      offEvents();
      offAccount();
      clearInterval(interval);
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      active = null;
    },
  };
  return active;
}
