import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncBackend } from '@/core/sync/backend';
// The same check the delete-account Edge Function enforces (hardening V-11) — one file for both.
import {
  FRESH_SIGN_IN_SECONDS,
  isFreshSignIn,
} from '../../../supabase/functions/delete-account/fresh';

/**
 * "Delete everything" (SPEC 6.7 D): a final export first, then the cloud copy (and, if chosen,
 * the account itself), then this device. The cloud goes first so that if it fails (offline,
 * paused project) nothing local is lost and the user is told; the device is wiped last.
 */
export interface DeleteSteps {
  /** Saves the final export; resolves 'cancelled' if the user backs out. */
  exportFinal(): Promise<'saved' | 'cancelled'>;
  /** Present when signed in. */
  cloud: { backend: SyncBackend; client: SupabaseClient } | null;
  deleteAccount: boolean;
  wipeDevice(): Promise<void>;
}

export type DeleteResult =
  { ok: true } | { ok: false; step: 'export' | 'reauth' | 'cloud' | 'account'; message: string };

const REAUTH_MESSAGE = `For your safety, deleting your account needs a recent sign-in. Sign out and sign in again (Settings → Account), then try again within ${FRESH_SIGN_IN_SECONDS / 60} minutes. Nothing was deleted.`;

export async function deleteEverything(s: DeleteSteps): Promise<DeleteResult> {
  if ((await s.exportFinal()) !== 'saved')
    return {
      ok: false,
      step: 'export',
      message: 'The final export was cancelled, so nothing was deleted.',
    };
  if (s.cloud && s.deleteAccount) {
    // Checked before anything is deleted: the server would refuse the account step anyway, and
    // the cloud copy must not be wiped first. Real time on purpose (not the dev clock): the
    // server compares with its own clock.
    const { data } = await s.cloud.client.auth.getSession();
    const token = data.session?.access_token ?? '';
    if (!isFreshSignIn(token, Math.floor(Date.now() / 1000)))
      return { ok: false, step: 'reauth', message: REAUTH_MESSAGE };
  }
  if (s.cloud) {
    try {
      await s.cloud.backend.reset();
    } catch {
      return {
        ok: false,
        step: 'cloud',
        message:
          'Couldn’t reach your cloud account, so nothing was deleted. Try again when you’re online.',
      };
    }
    if (s.deleteAccount) {
      const { error } = await s.cloud.client.functions.invoke('delete-account', { method: 'POST' });
      if (error && (error as { context?: Response }).context?.status === 403)
        return {
          ok: false,
          step: 'reauth',
          message: `Your cloud data is deleted, but the account needs a recent sign-in to be removed. ${REAUTH_MESSAGE.replace(' Nothing was deleted.', '')} This device was kept.`,
        };
      if (error)
        return {
          ok: false,
          step: 'account',
          message:
            'Your cloud data is deleted, but the account itself couldn’t be removed right now. This device was kept so you can try again.',
        };
      await s.cloud.client.auth.signOut();
    }
  }
  await s.wipeDevice();
  return { ok: true };
}
