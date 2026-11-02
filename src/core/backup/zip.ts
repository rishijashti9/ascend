import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { Photo } from '@/core/db/types';
import type { Backup } from './format';

/**
 * "Export with photos" (SPEC 7.6): a .zip with `ascend-backup.json` (the normal backup) and
 * `photos/<day>_<id>.<ext>`. Photos only ever leave the device this way, by Rishi's choice.
 */
export const ZIP_BACKUP_NAME = 'ascend-backup.json';

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function makeZip(backup: Backup, photos: readonly Photo[]): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {
    [ZIP_BACKUP_NAME]: strToU8(JSON.stringify(backup, null, 1)),
  };
  for (const p of photos) {
    const bytes = new Uint8Array(await p.blob.arrayBuffer());
    files[`photos/${p.day}_${p.id}.${EXT[p.mime] ?? 'jpg'}`] = bytes;
  }
  // Photos are already compressed; store them as-is (level 0) and compress only the JSON.
  return zipSync(files, { level: 0 });
}

export interface ZipContents {
  backup: unknown;
  photos: { id: string; day: string; mime: string; blob: Blob }[];
}

/** Reads an "Export with photos" file. Throws a plain-words error if it isn't one. */
export function readZip(bytes: Uint8Array): ZipContents {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('That .zip file couldn’t be opened.');
  }
  const json = files[ZIP_BACKUP_NAME];
  if (!json) throw new Error('That .zip isn’t an ASCEND export (no ascend-backup.json inside).');
  let backup: unknown;
  try {
    backup = JSON.parse(strFromU8(json));
  } catch {
    throw new Error('The backup inside the .zip is damaged.');
  }
  const photos: ZipContents['photos'] = [];
  for (const [name, data] of Object.entries(files)) {
    const m = /^photos\/(\d{4}-\d{2}-\d{2})_([^.]+)\.(\w+)$/.exec(name);
    if (!m?.[1] || !m[2] || !m[3]) continue;
    const mime = MIME[m[3].toLowerCase()] ?? 'image/jpeg';
    photos.push({ day: m[1], id: m[2], mime, blob: new Blob([data as BlobPart], { type: mime }) });
  }
  return { backup, photos };
}
