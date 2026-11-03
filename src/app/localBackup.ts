import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { backupFileName, buildBackup } from '@/core/backup/export';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { exportBackup } from './files';
import { isNativeApp } from './platform';

/**
 * A backup file written without asking (SPEC 9: before the first-sign-in choice, and weekly on
 * Android). Android: Documents/ASCEND/ — visible in the Files app and kept if ASCEND is
 * uninstalled (falls back to the app's own folder if the phone refuses). Web: the normal
 * download. Returns where it went, or null if nothing could be saved.
 */
export const BACKUP_FOLDER = 'ASCEND';

export async function writeLocalBackup(
  prefix: string,
  database: AscendDB = defaultDb,
): Promise<string | null> {
  if (!isNativeApp()) {
    return (await exportBackup(prefix)) === 'saved' ? 'Downloads' : null;
  }
  const backup = await buildBackup(database);
  const name = backupFileName(prefix);
  const data = JSON.stringify(backup);
  for (const directory of [Directory.Documents, Directory.External]) {
    try {
      await Filesystem.writeFile({
        path: `${BACKUP_FOLDER}/${name}`,
        data,
        directory,
        encoding: Encoding.UTF8,
        recursive: true,
      });
      return directory === Directory.Documents
        ? `Documents/${BACKUP_FOLDER}/${name}`
        : `Android/data/app.ascend.rishi/files/${BACKUP_FOLDER}/${name}`;
    } catch {
      // try the next place
    }
  }
  return null;
}
