import { z } from 'zod';
import { SCHEMA_VERSION, type TableName } from '@/core/db/db';
import { observeHlc } from '@/core/db/hlc';
import { incomingWins, SYNCED_TABLES } from '@/core/sync/merge';
import { defineAction } from '../registry';

/** Device-local sync bookkeeping (in `meta`, which never syncs). */
export const SYNC_META = {
  /** The account this device's data is synced with. */
  user: 'sync:user',
  /** Last server position pulled. */
  pullSeq: 'sync:pull_seq',
  /** Highest local HLC already pushed. */
  pushHlc: 'sync:push_hlc',
} as const;

const SYNCED = new Set<string>(SYNCED_TABLES);
type Row = Record<string, unknown> & { id: string; hlc: string };

const inRecord = z.object({
  tbl: z.string(),
  id: z.string(),
  hlc: z.string(),
  sort_key: z.string(),
  deleted: z.boolean(),
  data: z.record(z.string(), z.unknown()),
  seq: z.number(),
});

/**
 * Applies records pulled from the cloud (SPEC 9), in one transaction:
 * last write wins per record (merge.ts rules), xp_events are added only if this device
 * doesn't have that award yet (same idempotency key), and for a day only the low-energy
 * choice is taken — the rest of a day is recomputed here. Records written by a newer app
 * version are skipped until this app is updated.
 */
export const applySync = defineAction({
  type: 'sync.apply',
  schema: z.object({ records: z.array(inRecord).max(1000), cursor: z.number() }).strict(),
  tables: [...SYNCED_TABLES, 'meta'] as TableName[],
  async run(ctx, { records, cursor }) {
    const days = new Set<string>();
    let applied = 0;
    let newer = 0;
    for (const r of records) {
      const data = r.data as Row;
      if (!SYNCED.has(r.tbl) || typeof data.id !== 'string' || typeof data.hlc !== 'string')
        continue;
      if (Number(data.schema_version ?? 1) > SCHEMA_VERSION) {
        newer++;
        continue;
      }
      observeHlc(r.hlc);
      const table = ctx.db.table(r.tbl as TableName);
      const day = typeof data.day === 'string' ? data.day : null;

      if (r.tbl === 'xp_events') {
        const key = String(data.idempotency_key ?? '');
        if (key && (await ctx.db.xp_events.where('idempotency_key').equals(key).count()) > 0)
          continue;
        await table.put(data);
        applied++;
        if (day) days.add(day);
        continue;
      }

      const local = (await table.get(data.id)) as Row | undefined;
      if (r.tbl === 'days') {
        if (!local) await table.put(data);
        else if (incomingWins('days', local, local.hlc, data, r.sort_key)) {
          await table.put({
            ...local,
            low_energy: data.low_energy,
            low_energy_set_at: data.low_energy_set_at,
            hlc: data.hlc > local.hlc ? data.hlc : local.hlc,
          });
        } else continue;
        applied++;
        days.add(data.id);
        continue;
      }

      if (local && !incomingWins(r.tbl, local, local.hlc, data, r.sort_key)) continue;
      await table.put(data);
      applied++;
      if (day) days.add(day);
    }
    await ctx.db.meta.put({ id: SYNC_META.pullSeq, value: cursor });
    if (applied > 0) {
      ctx.emit({ type: 'DataSynced', payload: { applied, days: [...days].sort() } });
    }
    return { applied, newer, days: [...days].sort() };
  },
});

/** Remembers how far local changes have been pushed. */
export const markPushed = defineAction({
  type: 'sync.markPushed',
  schema: z.object({ hlc: z.string().min(1) }).strict(),
  tables: ['meta'],
  async run(ctx, { hlc }) {
    const current = (await ctx.db.meta.get(SYNC_META.pushHlc))?.value;
    if (typeof current !== 'string' || hlc > current) {
      await ctx.db.meta.put({ id: SYNC_META.pushHlc, value: hlc });
    }
    return true;
  },
});
