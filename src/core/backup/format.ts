import { z } from 'zod';
import { ALL_TABLES, SCHEMA_VERSION, type TableName } from '@/core/db/db';

/**
 * The backup file (SPEC 11: export/import). Plain JSON, versioned, validated with Zod on
 * import. Photos (device-only) and `meta` (device-local bookkeeping) are never exported.
 */
export const BACKUP_FORMAT = 'ascend-backup';

export const EXPORT_TABLES: readonly TableName[] = ALL_TABLES.filter(
  (t) => t !== 'photos' && t !== 'meta',
);

const iso = z.string().min(10);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'day must be YYYY-MM-DD');

/** Every record has these (SPEC 10). Other fields are kept as they are. */
const base = {
  id: z.string().min(1),
  created_at: iso,
  updated_at: iso,
  deleted_at: iso.nullable(),
  schema_version: z.number().int().min(1),
  hlc: z.string().min(1),
};
const record = (extra: z.ZodRawShape = {}) => z.looseObject({ ...base, ...extra });
const stat = z.enum(['STR', 'INT', 'WIL']);

/** Key fields checked per table — enough to reject a wrong or damaged file. */
const TABLE_SCHEMAS: Partial<Record<TableName, z.ZodType>> = {
  profile: record({ name: z.string(), start_day: day.nullable() }),
  settings: record({ day_start_hour: z.number().int(), wake_time: z.string() }),
  habits: record({
    title: z.string(),
    stat,
    status: z.enum(['active', 'paused', 'archived']),
    schedule: z.array(z.number().int().min(0).max(6)),
    measure: z.enum(['check', 'minutes', 'count', 'steps', 'sleep_hours']),
  }),
  quests: record({ type: z.enum(['weekly', 'side', 'recovery']), title: z.string() }),
  quest_instances: record({
    source_type: z.enum(['habit', 'quest']),
    source_id: z.string(),
    day,
    status: z.enum(['pending', 'done_full', 'done_min', 'done_late', 'skipped', 'missed']),
  }),
  progress_entries: record({ quest_instance_id: z.string(), day, amount: z.number() }),
  days: record({ day, active: z.boolean(), neutral: z.boolean() }),
  xp_events: record({
    day,
    occurred_at: iso,
    stat: stat.nullable(),
    base_amount: z.number(),
    idempotency_key: z.string().min(1),
  }),
};

const tablesShape = Object.fromEntries(
  EXPORT_TABLES.map((t) => [t, z.array(TABLE_SCHEMAS[t] ?? record()).optional()]),
) as Record<TableName, z.ZodOptional<z.ZodArray<z.ZodType>>>;

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT, 'This is not an ASCEND backup file.'),
  app_version: z.string(),
  schema_version: z
    .number()
    .int()
    .min(1)
    .max(
      SCHEMA_VERSION,
      'This backup was made by a newer version of ASCEND. Update the app first.',
    ),
  exported_at: iso,
  tables: z.object(tablesShape).strict(),
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupRecord = Record<string, unknown> & { id: string; hlc: string };

/**
 * Upgrades an older backup step by step to the current schema version before validation.
 * Add a step here whenever SCHEMA_VERSION goes up (e.g. `1: (b) => ...` turns v1 into v2).
 */
const UPGRADES: Record<number, (backup: Record<string, unknown>) => Record<string, unknown>> = {};

export function upgradeBackup(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  let backup = raw as Record<string, unknown>;
  let version = typeof backup.schema_version === 'number' ? backup.schema_version : SCHEMA_VERSION;
  while (version < SCHEMA_VERSION) {
    const step = UPGRADES[version];
    if (!step) break;
    backup = { ...step(backup), schema_version: version + 1 };
    version += 1;
  }
  return backup;
}

/** Validates (and upgrades) a parsed file. Problems come back in plain words. */
export function parseBackup(
  raw: unknown,
): { ok: true; backup: Backup } | { ok: false; error: string } {
  const result = backupSchema.safeParse(upgradeBackup(raw));
  if (result.success) return { ok: true, backup: result.data };
  const first = result.error.issues[0];
  const where = first?.path.length ? ` (${first.path.join(' › ')})` : '';
  return { ok: false, error: `${first?.message ?? 'Invalid backup file'}${where}` };
}

/** Number of records per table, for the confirmation screen. */
export function backupCounts(backup: Backup): { habits: number; days: number; xpEvents: number } {
  return {
    habits: backup.tables.habits?.length ?? 0,
    days: backup.tables.days?.length ?? 0,
    xpEvents: backup.tables.xp_events?.length ?? 0,
  };
}
