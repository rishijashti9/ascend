import type { InRecord, OutRecord, SyncBackend } from '@/core/sync/backend';
import { SyncUnavailable } from '@/core/sync/backend';
import { incomingWins, sortKey, V2_TABLES, type V2Table } from '@/core/sync/merge';
import { nowMs } from '@/core/time';

/**
 * An in-memory stand-in for the Supabase sync store (tests): one shared "cloud" per user,
 * with exactly the rules of push_records (merge.ts is checked against the SQL).
 */
export class MemoryCloud {
  private rows = new Map<string, InRecord>();
  private seq = 0;
  /** Simulate a paused project / no connection. */
  down: false | 'paused' | 'offline' = false;
  /** Server schema version (1 = before the Phase 8 migration: Phase 8 tables are refused). */
  version = 2;

  backend(): SyncBackend {
    const guard = () => {
      if (this.down) throw new SyncUnavailable(`cloud ${this.down}`, this.down);
    };
    return {
      push: async (records: OutRecord[]) => {
        guard();
        let accepted = 0;
        let kept = 0;
        if (this.version < 2 && records.some((r) => V2_TABLES.includes(r.tbl as V2Table)))
          throw new SyncUnavailable('violates check constraint "sync_records_tbl"', 'server');
        for (const r of records) {
          const key = `${r.tbl}|${r.id}`;
          const sort = sortKey(r.hlc, nowMs());
          const old = this.rows.get(key);
          if (!old || incomingWins(r.tbl, old.data, old.sort_key, r.data, sort)) {
            this.rows.set(key, { ...structuredClone(r), sort_key: sort, seq: ++this.seq });
            accepted++;
          } else kept++;
        }
        return { accepted, kept };
      },
      pull: async (since: number, limit: number) => {
        guard();
        return [...this.rows.values()]
          .filter((r) => r.seq > since)
          .sort((a, b) => a.seq - b.seq)
          .slice(0, limit)
          .map((r) => structuredClone(r));
      },
      isEmpty: async () => {
        guard();
        return this.rows.size === 0;
      },
      reset: async () => {
        guard();
        this.rows.clear();
      },
      serverVersion: async () => {
        guard();
        return this.version;
      },
    };
  }

  get(tbl: string, id: string): InRecord | undefined {
    return this.rows.get(`${tbl}|${id}`);
  }
  get size(): number {
    return this.rows.size;
  }
}
