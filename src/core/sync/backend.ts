import type { SupabaseClient } from '@supabase/supabase-js';

/** One local record on its way to the server. */
export interface OutRecord {
  tbl: string;
  /** Server id: the record id — for xp_events, its idempotency key (one award, one row). */
  id: string;
  hlc: string;
  deleted: boolean;
  data: Record<string, unknown>;
}

/** One record from the server, with its pull position. */
export interface InRecord extends OutRecord {
  sort_key: string;
  seq: number;
}

/** Where records are exchanged (Supabase in the app, an in-memory server in tests). */
export interface SyncBackend {
  push(records: OutRecord[]): Promise<{ accepted: number; kept: number }>;
  /** Records stored after `since` (by seq), oldest first. */
  pull(since: number, limit: number): Promise<InRecord[]>;
  /** Has the cloud anything for this user? (first sign-in) */
  isEmpty(): Promise<boolean>;
  /** Deletes this user's cloud copy ("keep this device's data"). */
  reset(): Promise<void>;
  /** Server schema version: 1 = Phase 7 tables only, 2 = Phase 8 tables accepted too. */
  serverVersion(): Promise<number>;
  /** This user's cloud copy: records and bytes (null when the server can't tell yet). */
  cloudUsage(): Promise<{ records: number; bytes: number } | null>;
  /**
   * Removes cloud detail summarised by a synced compaction. Returns rows removed, or null when
   * the server doesn't support it yet (migration not applied) — then it's simply tried later.
   */
  purgeCompacted(cutoff: string): Promise<number | null>;
}

/** A failure that means "try later" (offline, paused project, server busy) vs a real bug. */
export class SyncUnavailable extends Error {
  constructor(
    message: string,
    readonly reason: 'offline' | 'paused' | 'auth' | 'quota' | 'server',
  ) {
    super(message);
  }
}

function classify(error: { message?: string; code?: string; status?: number } | null): never {
  const msg = error?.message ?? 'Sync failed';
  const status = error?.status ?? 0;
  if (/fetch|network|Failed to fetch|Load failed/i.test(msg))
    throw new SyncUnavailable(msg, 'offline');
  if (status === 401 || status === 403 || error?.code === 'PGRST301' || error?.code === '28000')
    throw new SyncUnavailable(msg, 'auth');
  // The account's cloud copy reached its row ceiling (push_records, hardening V-02).
  if (error?.code === '53400') throw new SyncUnavailable(msg, 'quota');
  // A paused free-tier project answers 540 / 503 or not at all (SPEC 9).
  if (status === 540 || status === 503 || status === 502 || status === 504 || /paused/i.test(msg))
    throw new SyncUnavailable(msg, 'paused');
  throw new SyncUnavailable(msg, 'server');
}

export function supabaseBackend(client: SupabaseClient): SyncBackend {
  const call = async <T>(
    p: PromiseLike<{ data: T; error: unknown; status?: number }>,
  ): Promise<T> => {
    let res: { data: T; error: unknown; status?: number };
    try {
      res = await p;
    } catch (error) {
      classify({ message: error instanceof Error ? error.message : String(error) });
    }
    if (res.error) classify({ ...(res.error as object), status: res.status });
    return res.data;
  };
  return {
    async push(records) {
      if (records.length === 0) return { accepted: 0, kept: 0 };
      return call(client.rpc('push_records', { p_records: records })) as Promise<{
        accepted: number;
        kept: number;
      }>;
    },
    async pull(since, limit) {
      const rows = await call(
        client
          .from('sync_records')
          .select('tbl,id,hlc,sort_key,deleted,data,seq')
          .gt('seq', since)
          .order('seq', { ascending: true })
          .limit(limit),
      );
      return (rows as InRecord[]).map((r) => ({ ...r, seq: Number(r.seq) }));
    },
    async isEmpty() {
      const rows = await call(client.from('sync_records').select('id').limit(1));
      return (rows as unknown[]).length === 0;
    },
    async reset() {
      await call(client.rpc('reset_my_cloud_data'));
    },
    async purgeCompacted(cutoff) {
      const res = await client.rpc('compact_my_records', { p_cutoff: cutoff });
      if (res.error?.code === 'PGRST202' || res.status === 404) return null;
      if (res.error) classify({ ...res.error, status: res.status });
      return Number(res.data ?? 0);
    },
    async cloudUsage() {
      const res = await client.rpc('my_cloud_usage');
      if (res.error?.code === 'PGRST202' || res.status === 404) return null; // not applied yet
      if (res.error) classify({ ...res.error, status: res.status });
      const d = res.data as { records?: number; bytes?: number } | null;
      return d ? { records: Number(d.records ?? 0), bytes: Number(d.bytes ?? 0) } : null;
    },
    async serverVersion() {
      let res: {
        data: unknown;
        error: { code?: string; message?: string } | null;
        status?: number;
      };
      try {
        res = await client.rpc('sync_server_version');
      } catch (error) {
        classify({ message: error instanceof Error ? error.message : String(error) });
      }
      // Function not there yet (migration not applied): a Phase 7 server.
      if (res.error?.code === 'PGRST202' || res.status === 404) return 1;
      if (res.error) classify({ ...res.error, status: res.status });
      return Number(res.data) || 1;
    },
  };
}
