import { APP_VERSION } from '@/app/version';
import { db as defaultDb, SCHEMA_VERSION, type AscendDB } from '@/core/db/db';
import { nowMs } from '@/core/time';
import { BACKUP_FORMAT, EXPORT_TABLES, type Backup } from './format';

/**
 * Reads every exportable table in one read transaction (a consistent snapshot) and returns the
 * backup object. Soft-deleted records are included so history and sync stay exact.
 */
export async function buildBackup(database: AscendDB = defaultDb): Promise<Backup> {
  const tables = await database.transaction('r', [...EXPORT_TABLES], async () => {
    const entries = await Promise.all(
      EXPORT_TABLES.map(async (t) => [t, await database.table(t).toArray()] as const),
    );
    return Object.fromEntries(entries);
  });
  return {
    format: BACKUP_FORMAT,
    app_version: APP_VERSION,
    schema_version: SCHEMA_VERSION,
    exported_at: new Date(nowMs()).toISOString(),
    tables,
  };
}

/** `ascend-backup-2026-11-02.json` (or `ascend-before-import-…`). */
export function backupFileName(prefix = 'ascend-backup'): string {
  const d = new Date(nowMs());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}
