import { z } from 'zod';
import { SCHEMA_VERSION, type TableName } from '@/core/db/db';
import { observeHlc } from '@/core/db/hlc';
import { incomingWins, SYNCED_TABLES } from '@/core/sync/merge';
import { isRecoveryId } from '@/core/engine/instances';
import { refreshDayRecord } from '../days';
import { defineAction } from '../registry';
import { refreshStreaks } from '../streaks';
import { QUEST_TABLES } from './questCommon';
import { syncStatusWithProgress } from './quests';

/** Device-local sync bookkeeping (in `meta`, which never syncs). */
export const SYNC_META = {
  /** The account this device's data is synced with. */
  user: 'sync:user',
  /** Last server position pulled. */
  pullSeq: 'sync:pull_seq',
  /** Highest local HLC already pushed. */
  pushHlc: 'sync:push_hlc',
  /** The server accepts the Phase 8 tables and they were uploaded in full once. */
  serverV2: 'sync:server_v2',
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
    // Local records up to this HLC were already pushed: the server's copy has been judged
    // against them and is the winner. Only changes not pushed yet need comparing.
    const mark = (await ctx.db.meta.get(SYNC_META.pushHlc))?.value;
    const pushedMark = typeof mark === 'string' ? mark : '';
    const replaces = (tbl: string, local: Row, data: Row, sort: string) =>
      local.hlc <= pushedMark || incomingWins(tbl, local, local.hlc, data, sort);
    for (const r of records) {
      const data = r.data as Row;
      if (!SYNCED.has(r.tbl) || typeof data.id !== 'string' || typeof data.hlc !== 'string')
        continue;
      if (Number(data.schema_version ?? 1) > SCHEMA_VERSION) {
        newer++;
        continue;
      }
      // The capped time: a far-ahead clock elsewhere must not drag this device's clock along.
      observeHlc(r.sort_key);
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
        else if (replaces('days', local, data, r.sort_key)) {
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

      if (local && !replaces(r.tbl, local, data, r.sort_key)) continue;
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

/** The server accepts the Phase 8 tables, and their full first upload is done. */
export const markServerV2 = defineAction({
  type: 'sync.markServerV2',
  schema: z.object({}).strict(),
  tables: ['meta'],
  async run(ctx) {
    await ctx.db.meta.put({ id: SYNC_META.serverV2, value: true });
    return true;
  },
});

/**
 * After records arrive from another device (SPEC 9: "the progress engine recomputes derived
 * values"): numeric quests are re-checked against all their progress entries — focus minutes
 * from one device and manual minutes from another add up — then the touched days are
 * re-evaluated (closed days too: a completion that arrives late turns a missed day active)
 * and streaks recomputed. Status only ever goes up here; XP uses the usual award keys, so two
 * devices recomputing the same thing still produce one award.
 */
export const recomputeAfterSync = defineAction({
  type: 'sync.recompute',
  schema: z.object({ days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(2000) }).strict(),
  tables: [...QUEST_TABLES, 'xp_events'] as TableName[],
  async run(ctx, { days }) {
    const touched = new Set(days);
    for (const day of days) {
      for (const instance of await ctx.db.quest_instances.where('day').equals(day).toArray()) {
        if (
          instance.deleted_at ||
          instance.measure_snapshot === 'check' ||
          isRecoveryId(instance.id)
        )
          continue;
        const entries = await ctx.db.progress_entries
          .where('quest_instance_id')
          .equals(instance.id)
          .toArray();
        if (entries.length === 0) continue;
        // The XP day is the day the last minutes came in (weekly quests span a week).
        const xpDay = entries.reduce((d, e) => (e.day > d ? e.day : d), instance.day);
        const next = await syncStatusWithProgress(ctx, instance, xpDay);
        if (next !== instance) touched.add(xpDay);
      }
    }
    for (const day of [...touched].sort()) {
      await refreshDayRecord(ctx.db, day, ctx.processedAt);
      ctx.emit({ type: 'DayChanged', payload: { day } });
    }
    // Streak fields may have come from the other device's view: recompute them here.
    await refreshStreaks(ctx.db, ctx.processedAt);
    return [...touched].sort();
  },
});

/**
 * Connects this device's data to an account (first sign-in, SPEC 9). `fresh` starts the
 * exchange from the beginning (push everything, pull everything); `clearLocal` first removes
 * every synced record on this device ("use the cloud data") — photos and device settings stay.
 */
export const linkAccount = defineAction({
  type: 'sync.link',
  schema: z.object({ userId: z.string().min(1), clearLocal: z.boolean() }).strict(),
  tables: [...SYNCED_TABLES, 'meta'] as TableName[],
  async run(ctx, { userId, clearLocal }) {
    if (clearLocal) {
      for (const tbl of SYNCED_TABLES) await ctx.db.table(tbl as TableName).clear();
    }
    await ctx.db.meta.put({ id: SYNC_META.user, value: userId });
    await ctx.db.meta.put({ id: SYNC_META.pullSeq, value: 0 });
    await ctx.db.meta.delete(SYNC_META.pushHlc);
    ctx.emit({ type: 'SyncLinked', payload: { clearLocal } });
    return true;
  },
});
