import type { SupabaseClient } from '@supabase/supabase-js';
import type { SyncBackend } from '@/core/sync/backend';

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
  { ok: true } | { ok: false; step: 'export' | 'cloud' | 'account'; message: string };

export async function deleteEverything(s: DeleteSteps): Promise<DeleteResult> {
  if ((await s.exportFinal()) !== 'saved')
    return {
      ok: false,
      step: 'export',
      message: 'The final export was cancelled, so nothing was deleted.',
    };
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
