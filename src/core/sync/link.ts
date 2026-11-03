import type { AscendDB } from '@/core/db/db';
import { recordAction } from '@/core/pipeline';
import { SYNC_META } from '@/core/pipeline/actions/sync';
import type { SyncBackend } from './backend';
import { localChanges, syncOnce } from './engine';

/**
 * First sign-in (SPEC 9): what to do when this device meets an account.
 * - `linked`: already synced with this account — just sync.
 * - `upload`: the cloud is empty and this device has never synced with an account — its
 *   data goes up.
 * - `download`: this device has nothing yet (fresh install) — the cloud data comes down.
 * - `choose`: both have data (or this device last synced with another account) — Rishi
 *   chooses: merge, keep this device's data, or use the cloud data (after a backup).
 */
export type LinkStatus = 'linked' | 'upload' | 'download' | 'choose';
export type LinkChoice = 'merge' | 'keep_device' | 'use_cloud';

export async function linkStatus(
  db: AscendDB,
  backend: SyncBackend,
  userId: string,
): Promise<LinkStatus> {
  const linkedTo = (await db.meta.get(SYNC_META.user))?.value;
  if (linkedTo === userId) return 'linked';
  const deviceHasData = !!(await db.profile.get('profile'))?.onboarded_at;
  const cloudEmpty = await backend.isEmpty();
  if (!deviceHasData) return 'download';
  if (cloudEmpty && linkedTo === undefined) return 'upload';
  return 'choose';
}

/** After a download, nothing local needs pushing back: mark it all as pushed. */
async function markAllPushed(db: AscendDB) {
  const changes = await localChanges(db);
  const last = changes.at(-1);
  if (last)
    await recordAction(
      { type: 'sync.markPushed', source: 'sync', payload: { hlc: last.hlc } },
      { db },
    );
}

export async function connect(
  db: AscendDB,
  backend: SyncBackend,
  userId: string,
  how: 'upload' | 'download' | LinkChoice,
): Promise<void> {
  const clearLocal = how === 'download' || how === 'use_cloud';
  if (how === 'keep_device') await backend.reset();
  await recordAction(
    { type: 'sync.link', source: 'sync', payload: { userId, clearLocal } },
    { db },
  );
  await syncOnce(db, backend);
  if (clearLocal) await markAllPushed(db);
}
