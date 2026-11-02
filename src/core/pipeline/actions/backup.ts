import { z } from 'zod';
import {
  backupSchema,
  EXPORT_TABLES,
  upgradeBackup,
  type BackupRecord,
} from '@/core/backup/format';
import type { AscendDB, TableName } from '@/core/db/db';
import { defineAction } from '../registry';
import { rebuildDays, type RebuildResult } from './progress';

/**
 * Import a backup (SPEC 11). Runs in ONE transaction: if anything fails, nothing changes.
 * - replace: this device's data becomes exactly the backup's.
 * - merge: for each record the newer write wins (HLC), XP events are deduped by their
 *   idempotency key — the same rules sync will use (PLAN 1), so a merge never double-counts.
 * Day fields and streaks are recomputed afterwards, never trusted from the file.
 */
export interface ImportResult {
  mode: 'replace' | 'merge';
  /** Records written (new or newer). */
  written: number;
  /** Records skipped because this device already had the same or a newer version. */
  skipped: number;
  rebuild: RebuildResult;
}

async function mergeTable(db: AscendDB, table: TableName, records: BackupRecord[]) {
  let written = 0;
  for (const incoming of records) {
    const existing = (await db.table(table).get(incoming.id)) as BackupRecord | undefined;
    if (table === 'xp_events' && !existing) {
      // Append-only: the same award earned on another device has the same idempotency key.
      const twin = await db.xp_events
        .where('idempotency_key')
        .equals(String(incoming.idempotency_key))
        .first();
      if (twin) continue;
    }
    if (existing && existing.hlc >= incoming.hlc) continue;
    await db.table(table).put(incoming);
    written++;
  }
  return written;
}

export const importData = defineAction({
  type: 'data.import',
  schema: z
    .object({
      mode: z.enum(['replace', 'merge']),
      backup: z.preprocess(upgradeBackup, backupSchema),
    })
    .strict(),
  tables: [...EXPORT_TABLES],
  async run(ctx, { mode, backup }): Promise<ImportResult> {
    const { db } = ctx;
    let written = 0;
    let total = 0;
    for (const table of EXPORT_TABLES) {
      const records = (backup.tables[table] ?? []) as BackupRecord[];
      total += records.length;
      if (mode === 'replace') {
        // Settings are kept if the file has none, so the app always has a settings record.
        if (table === 'settings' && records.length === 0) continue;
        await db.table(table).clear();
        await db.table(table).bulkPut(records);
        written += records.length;
      } else {
        written += await mergeTable(db, table, records);
      }
    }
    const rebuild = await rebuildDays(db, ctx.processedAt);
    ctx.emit({ type: 'DataImported', payload: { mode } });
    return { mode, written, skipped: total - written, rebuild };
  },
});

/** Remembers when the last export happened (for the backup reminder). Device-local. */
export const recordExport = defineAction({
  type: 'backup.recorded',
  schema: z.object({}).strict(),
  tables: [],
  async run(ctx) {
    await ctx.db.meta.put({ id: 'last_export_at', value: ctx.processedAt });
    ctx.emit({ type: 'SettingsChanged', payload: { changed: ['last_export_at'] } });
  },
});

/** "Later" on the backup reminder: ask again in 3 days. */
export const snoozeBackupReminder = defineAction({
  type: 'backup.snooze',
  schema: z.object({}).strict(),
  tables: [],
  async run(ctx) {
    const until = new Date(Date.parse(ctx.processedAt) + 3 * 86_400_000).toISOString();
    await ctx.db.meta.put({ id: 'backup_snooze_until', value: until });
    ctx.emit({ type: 'SettingsChanged', payload: { changed: ['backup_snooze_until'] } });
  },
});
