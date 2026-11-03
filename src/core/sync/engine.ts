import type { AscendDB, TableName } from '@/core/db/db';
import { recordAction } from '@/core/pipeline';
import { SYNC_META } from '@/core/pipeline/actions/sync';
import type { OutRecord, SyncBackend } from './backend';
import { SYNCED_TABLES } from './merge';

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

/** Every local change not pushed yet, oldest first. */
export async function localChanges(db: AscendDB): Promise<OutRecord[]> {
  const mark = (await db.meta.get(SYNC_META.pushHlc))?.value;
  const since = typeof mark === 'string' ? mark : '';
  const out: OutRecord[] = [];
  for (const tbl of SYNCED_TABLES) {
    const rows = (await db
      .table(tbl as TableName)
      .filter((r: Row) => r.hlc > since)
      .toArray()) as Row[];
    for (const r of rows) out.push(toOutRecord(tbl, r));
  }
  return out.sort((a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0));
}

export async function pushChanges(db: AscendDB, backend: SyncBackend): Promise<number> {
  const changes = await localChanges(db);
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

export async function syncOnce(
  db: AscendDB,
  backend: SyncBackend,
): Promise<{ pushed: number; pulled: number; days: string[] }> {
  const pushed = await pushChanges(db, backend);
  const { pulled, days } = await pullChanges(db, backend);
  if (days.length > 0) {
    await recordAction({ type: 'sync.recompute', source: 'sync', payload: { days } }, { db });
  }
  return { pushed, pulled, days };
}
