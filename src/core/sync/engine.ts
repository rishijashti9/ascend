import type { AscendDB, TableName } from '@/core/db/db';
import { recordAction } from '@/core/pipeline';
import { SYNC_META } from '@/core/pipeline/actions/sync';
import type { OutRecord, SyncBackend } from './backend';
import { compactedBefore } from '@/core/compaction/expanded';
import { SERVER_VERSION, SYNCED_TABLES, tableServerVersion } from './merge';

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
 * Newer tables travel only once the server accepts them (Phase 8 → server version 2, Phase 11 →
 * 3). `known` = the server version whose tables were already uploaded in full; `server` = what
 * the server accepts now. A table the server doesn't accept yet stays on the device; the first
 * round after it does uploads everything written meanwhile, then only changes.
 */
export interface ServerVersions {
  known: number;
  server: number;
}

const CURRENT: ServerVersions = { known: SERVER_VERSION, server: SERVER_VERSION };

/** Every local change not pushed yet, oldest first. */
export async function localChanges(
  db: AscendDB,
  versions: ServerVersions = CURRENT,
): Promise<OutRecord[]> {
  const mark = (await db.meta.get(SYNC_META.pushHlc))?.value;
  const since = typeof mark === 'string' ? mark : '';
  const out: OutRecord[] = [];
  for (const tbl of SYNCED_TABLES) {
    const needs = tableServerVersion(tbl);
    if (versions.server < needs) continue;
    const from = versions.known < needs ? '' : since;
    const rows = (await db
      .table(tbl as TableName)
      .filter((r: Row) => r.hlc > from)
      .toArray()) as Row[];
    for (const r of rows) out.push(toOutRecord(tbl, r));
  }
  return out.sort((a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0));
}

/** The server version whose tables this device already uploaded in full. */
export async function knownServerVersion(db: AscendDB): Promise<number> {
  const v = (await db.meta.get(SYNC_META.serverVersion))?.value;
  if (typeof v === 'number') return v;
  return (await db.meta.get(SYNC_META.serverV2))?.value === true ? 2 : 1;
}

async function serverVersions(db: AscendDB, backend: SyncBackend): Promise<ServerVersions> {
  const known = await knownServerVersion(db);
  if (known >= SERVER_VERSION) return { known, server: known };
  return { known, server: Math.min(SERVER_VERSION, await backend.serverVersion()) };
}

export async function pushChanges(db: AscendDB, backend: SyncBackend): Promise<number> {
  const versions = await serverVersions(db, backend);
  const changes = await localChanges(db, versions);
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
  if (versions.server > versions.known) {
    await recordAction(
      { type: 'sync.markServerVersion', source: 'sync', payload: { version: versions.server } },
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

async function purgeCloud(db: AscendDB, backend: SyncBackend): Promise<void> {
  const cutoff = await compactedBefore(db);
  const done = (await db.meta.get(SYNC_META.purged))?.value;
  if (!cutoff || (typeof done === 'string' && done >= cutoff)) return;
  if ((await knownServerVersion(db)) < 2) return; // summaries not up yet
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
