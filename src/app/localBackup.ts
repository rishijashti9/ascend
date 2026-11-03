import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { backupFileName, buildBackup } from '@/core/backup/export';
import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { recordAction } from '@/core/pipeline';
import { nowMs } from '@/core/time';
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

// "Once a week" with half a day of slack: opening the app at the same time each week must not
// skip a week because the next run is a few minutes short of exactly 7 days.
const WEEK_MS = 6.5 * 86_400_000;
export const WEEKLY_PREFIX = 'ascend-weekly';
export const KEEP_WEEKLY = 4;

/** Keeps only the newest weekly files (names carry the date, so they sort by age). */
async function pruneWeekly(): Promise<void> {
  for (const directory of [Directory.Documents, Directory.External]) {
    try {
      const { files } = await Filesystem.readdir({ path: BACKUP_FOLDER, directory });
      const weekly = files
        .map((f) => f.name)
        .filter((n) => n.startsWith(`${WEEKLY_PREFIX}-`))
        .sort()
        .reverse();
      for (const name of weekly.slice(KEEP_WEEKLY)) {
        await Filesystem.deleteFile({ path: `${BACKUP_FOLDER}/${name}`, directory });
      }
    } catch {
      // folder not there: nothing to prune
    }
  }
}

/**
 * Android: once a week, a backup file of everything (SPEC 9: "write an automatic local backup
 * file weekly"), so the data survives even if the app's storage is cleared. Runs at startup;
 * does nothing on the web, before onboarding, or if the last one is less than 7 days old.
 */
export async function runWeeklyLocalBackup(database: AscendDB = defaultDb): Promise<string | null> {
  if (!isNativeApp()) return null;
  try {
    if (!(await database.profile.get('profile'))?.onboarded_at) return null;
    const last = (await database.meta.get('local_backup_at'))?.value;
    if (typeof last === 'string' && nowMs() - Date.parse(last) < WEEK_MS) return null;
    const path = await writeLocalBackup(WEEKLY_PREFIX, database);
    if (!path) return null;
    await recordAction({ type: 'backup.localSaved', payload: { path } }, { db: database });
    await pruneWeekly();
    return path;
  } catch (error) {
    logError(error, 'backup.weekly');
    return null;
  }
}
