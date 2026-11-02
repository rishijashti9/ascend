import { logError } from '@/core/errorLog';
import { db, type AscendDB } from './db';

export type PersistResult = 'granted' | 'denied' | 'unsupported';

/**
 * Asks the browser/OS not to clear our data under storage pressure (SPEC 9).
 * Installed PWAs and the Android app usually get this automatically.
 */
export async function requestPersistentStorage(database: AscendDB = db): Promise<PersistResult> {
  let result: PersistResult = 'unsupported';
  try {
    if (navigator.storage?.persist) {
      const already = (await navigator.storage.persisted?.()) ?? false;
      result = already || (await navigator.storage.persist()) ? 'granted' : 'denied';
    }
  } catch (error) {
    logError(error, 'storage.persist');
  }
  await database.meta.put({ id: 'storage_persist', value: result });
  return result;
}

/**
 * Opens the database and runs any pending schema migrations.
 * Called before the first screen renders (SPEC 9: migrations run before any screen loads).
 */
export async function openDatabase(database: AscendDB = db): Promise<void> {
  await database.open();
  // Another tab with an older version open would block upgrades: ask it to close.
  database.on('versionchange', () => {
    database.close();
    window.location.reload();
  });
  void requestPersistentStorage(database);
}

/**
 * Deletes every record on this device (Settings → Reset all data). The caller reloads the
 * app afterwards, which starts fresh with onboarding. The local crash log is kept.
 */
export async function deleteAllData(database: AscendDB = db): Promise<void> {
  database.close();
  await database.delete();
}
