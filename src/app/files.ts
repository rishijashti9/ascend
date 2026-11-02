import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { buildBackup, backupFileName } from '@/core/backup/export';
import { makeZip } from '@/core/backup/zip';
import { db } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { recordAction } from '@/core/pipeline';
import { isNativeApp } from './platform';

/** Base64 of a blob (the Android file system takes binary data as base64). */
async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Saves a file for the person to keep.
 * - Browser / installed PWA: a normal download.
 * - Android app: written to the app's cache, then the share sheet opens so it can be saved to
 *   Files, Google Drive, email, etc. (a WebView can't download files by itself).
 */
export async function saveFile(name: string, data: string | Blob): Promise<'saved' | 'cancelled'> {
  if (isNativeApp()) {
    const { uri } = await Filesystem.writeFile(
      typeof data === 'string'
        ? { path: name, data, directory: Directory.Cache, encoding: Encoding.UTF8 }
        : { path: name, data: await toBase64(data), directory: Directory.Cache },
    );
    try {
      await Share.share({ title: 'ASCEND backup', files: [uri] });
      return 'saved';
    } catch {
      return 'cancelled'; // closed the share sheet
    }
  }
  const blob = typeof data === 'string' ? new Blob([data], { type: 'application/json' }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}

/** Kept for text exports. */
export const saveTextFile = (name: string, text: string) => saveFile(name, text);

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

/** "Export with photos": the backup plus every body photo, as one .zip (SPEC 7.6). */
export async function exportWithPhotos(): Promise<'saved' | 'cancelled'> {
  const [backup, photos] = await Promise.all([buildBackup(), db.photos.toArray()]);
  const bytes = await makeZip(backup, photos);
  const name = backupFileName('ascend-backup-with-photos').replace(/\.json$/, '.zip');
  const outcome = await saveFile(name, new Blob([bytes as BlobPart], { type: 'application/zip' }));
  if (outcome === 'saved') {
    await recordAction({ type: 'backup.recorded', payload: {} }).catch((e: unknown) =>
      logError(e, 'backup.recorded'),
    );
  }
  return outcome;
}
