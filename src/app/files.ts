import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { buildBackup, backupFileName } from '@/core/backup/export';
import { logError } from '@/core/errorLog';
import { recordAction } from '@/core/pipeline';
import { isNativeApp } from './platform';

/**
 * Saves a text file for the person to keep.
 * - Browser / installed PWA: a normal download.
 * - Android app: written to the app's cache, then the share sheet opens so it can be saved to
 *   Files, Google Drive, email, etc. (a WebView can't download files by itself).
 */
export async function saveTextFile(name: string, text: string): Promise<'saved' | 'cancelled'> {
  if (isNativeApp()) {
    const { uri } = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({ title: 'ASCEND backup', files: [uri] });
      return 'saved';
    } catch {
      return 'cancelled'; // closed the share sheet
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}

/** Exports everything to a JSON file and remembers when (for the backup reminder). */
export async function exportBackup(prefix?: string): Promise<'saved' | 'cancelled'> {
  const backup = await buildBackup();
  const outcome = await saveTextFile(backupFileName(prefix), JSON.stringify(backup, null, 1));
  if (outcome === 'saved') {
    await recordAction({ type: 'backup.recorded', payload: {} }).catch((e: unknown) =>
      logError(e, 'backup.recorded'),
    );
  }
  return outcome;
}
