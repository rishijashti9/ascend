import { createStore, useStore } from 'zustand';
import type { PlannedNotification } from '@/core/notifications/types';

/**
 * In-app reminders (web, SPEC 8: "show reminders in-app"): a reminder that comes due while
 * ASCEND is open appears as a banner, whether or not browser notifications are on.
 */
export interface NoticesState {
  notices: PlannedNotification[];
}

export const noticesStore = createStore<NoticesState>(() => ({ notices: [] }));

export function useNotices<T>(selector: (state: NoticesState) => T): T {
  return useStore(noticesStore, selector);
}

export function pushNotice(n: PlannedNotification): void {
  noticesStore.setState((s) => ({
    notices: [...s.notices.filter((x) => x.key !== n.key), n].slice(-3),
  }));
}

export function dismissNotice(key: string): void {
  noticesStore.setState((s) => ({ notices: s.notices.filter((x) => x.key !== key) }));
}
