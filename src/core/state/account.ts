import { createStore, useStore } from 'zustand';
import { logError } from '@/core/errorLog';
import { getSupabase } from '@/core/sync/client';

/** Who is signed in (sync account), if anyone. */
export interface AccountState {
  status: 'unavailable' | 'loading' | 'signed_out' | 'signed_in';
  userId: string | null;
  email: string | null;
  /** A message from the last sign-in attempt that came back to the app (Android), if any. */
  notice: string | null;
}

export const accountStore = createStore<AccountState>(() => ({
  status: 'loading',
  userId: null,
  email: null,
  notice: null,
}));

export function useAccount<T>(selector: (state: AccountState) => T): T {
  return useStore(accountStore, selector);
}

export async function startAccount(): Promise<() => void> {
  const c = getSupabase();
  if (!c) {
    accountStore.setState({ status: 'unavailable' });
    return () => undefined;
  }
  const set = (user: { id: string; email?: string } | null | undefined) =>
    accountStore.setState({
      status: user ? 'signed_in' : 'signed_out',
      userId: user?.id ?? null,
      email: user?.email ?? null,
    });
  const { data } = c.auth.onAuthStateChange((_event, session) => set(session?.user));
  try {
    set((await c.auth.getSession()).data.session?.user);
  } catch (error) {
    logError(error, 'account.load');
    set(null);
  }
  return () => data.subscription.unsubscribe();
}
