import type { AscendDB, TableName } from '@/core/db/db';
import { recordAction } from '@/core/pipeline';
import { SYNC_META } from '@/core/pipeline/actions/sync';
import type { OutRecord, SyncBackend } from './backend';
import { compactedBefore } from '@/core/compaction/expanded';
import { SYNCED_TABLES, V2_TABLES } from './merge';

/**
 * One sync round (SPEC 9): push every local change since the last push, then pull every
 * cloud change since the last pull and apply it. Both directions are batched and resumable:
 * a round cut short by a lost connection continues where it stopped next time.
 */
const BATCH = 500;

type Row = Record<string, unknown> & { id: string; hlc: string; deleted_at?: string | null };

export function toOutRecord(tbl: string, row: Row): OutRecord {
  return {
    tbl,
    // One award, one row: the same XP event from two devices has the same idempotency key.
    id: tbl === 'xp_events' ? String(row.idempotency_key) : row.id,
    hlc: row.hlc,
    deleted: !!row.deleted_at,
    data: row,
  };
}

/**
 * How the Phase 8 tables travel: `skip` while the server doesn't accept them yet (they stay on
 * the device), `all` once when it first does (everything written meanwhile goes up), then `new`.
 */
export type V2Mode = 'skip' | 'all' | 'new';

/** Every local change not pushed yet, oldest first. */
export async function localChanges(db: AscendDB, v2: V2Mode = 'new'): Promise<OutRecord[]> {
  const mark = (await db.meta.get(SYNC_META.pushHlc))?.value;
  const since = typeof mark === 'string' ? mark : '';
  const out: OutRecord[] = [];
  for (const tbl of SYNCED_TABLES) {
    const isV2 = (V2_TABLES as readonly string[]).includes(tbl);
    if (isV2 && v2 === 'skip') continue;
    const from = isV2 && v2 === 'all' ? '' : since;
    const rows = (await db
      .table(tbl as TableName)
      .filter((r: Row) => r.hlc > from)
      .toArray()) as Row[];
    for (const r of rows) out.push(toOutRecord(tbl, r));
  }
  return out.sort((a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0));
}

async function v2Mode(db: AscendDB, backend: SyncBackend): Promise<V2Mode> {
  if ((await db.meta.get(SYNC_META.serverV2))?.value === true) return 'new';
  return (await backend.serverVersion()) >= 2 ? 'all' : 'skip';
}

export async function pushChanges(db: AscendDB, backend: SyncBackend): Promise<number> {
  const mode = await v2Mode(db, backend);
  const changes = await localChanges(db, mode);
  for (let i = 0; i < changes.length; i += BATCH) {
    const batch = changes.slice(i, i + BATCH);
    await backend.push(batch);
    const last = batch.at(-1);
    if (last)
      await recordAction(
        { type: 'sync.markPushed', source: 'sync', payload: { hlc: last.hlc } },
        { db },
      );
  }
  if (mode === 'all') {
    await recordAction({ type: 'sync.markServerV2', source: 'sync', payload: {} }, { db });
  }
  return changes.length;
}

export async function pullChanges(
  db: AscendDB,
  backend: SyncBackend,
): Promise<{ pulled: number; days: string[] }> {
  const stored = (await db.meta.get(SYNC_META.pullSeq))?.value;
  let cursor = typeof stored === 'number' ? stored : 0;
  let pulled = 0;
  const days = new Set<string>();
  for (;;) {
    const rows = await backend.pull(cursor, BATCH);
    if (rows.length === 0) break;
    cursor = rows.at(-1)?.seq ?? cursor;
    const { value } = await recordAction<{ applied: number; days: string[] }>(
      { type: 'sync.apply', source: 'sync', payload: { records: rows, cursor } },
      { db },
    );
    pulled += value?.applied ?? 0;
    for (const d of value?.days ?? []) days.add(d);
    if (rows.length < BATCH) break;
  }
  return { pulled, days: [...days].sort() };
}

async function purgeCloud(db: AscendDB, backend: SyncBackend): Promise<void> {
  const cutoff = await compactedBefore(db);
  const done = (await db.meta.get(SYNC_META.purged))?.value;
  if (!cutoff || (typeof done === 'string' && done >= cutoff)) return;
  if ((await db.meta.get(SYNC_META.serverV2))?.value !== true) return; // summaries not up yet
  const n = await backend.purgeCompacted(cutoff);
  if (n === null) return; // server not ready — try again next round
  await recordAction({ type: 'sync.markPurged', source: 'sync', payload: { cutoff } }, { db });
}

export async function syncOnce(
  db: AscendDB,
  backend: SyncBackend,
): Promise<{ pushed: number; pulled: number; days: string[] }> {
  const pushed = await pushChanges(db, backend);
  const { pulled, days } = await pullChanges(db, backend);
  // Compaction (SPEC 6.7 D): drop local detail another device summarised, and once our own
  // compaction has synced, have the server drop the same old detail.
  if (pulled > 0) {
    await recordAction({ type: 'data.compactLocal', source: 'sync', payload: {} }, { db });
  }
  await purgeCloud(db, backend);
  if (days.length > 0) {
    await recordAction({ type: 'sync.recompute', source: 'sync', payload: { days } }, { db });
  }
  return { pushed, pulled, days };
}
