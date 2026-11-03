import type { AscendDB } from '@/core/db/db';
import type { DayString } from '@/core/db/types';
import { expandSummaries, type Expanded } from './summaries';

/**
 * Compacted history as the engines read it (SPEC 6.7 D). Every reader that needs old detail —
 * progress, achievements, skills, goals, focus totals — adds these rows to the live ones.
 * Expanded once per change of the summaries table (cached by its count + newest clock).
 */
const EMPTY: Expanded = { dayXp: new Map(), instances: [], entries: [], sessions: [], bodyDays: 0 };
let cache: { db: AscendDB; key: string; value: Expanded } | null = null;

export async function loadExpanded(db: AscendDB): Promise<Expanded> {
  const rows = (await db.summaries.toArray()).filter((s) => s.deleted_at === null);
  if (rows.length === 0) return EMPTY;
  const key = `${rows.length}|${rows.reduce((m, r) => (r.hlc > m ? r.hlc : m), '')}`;
  if (cache && cache.db === db && cache.key === key) return cache.value;
  const value = expandSummaries(rows);
  cache = { db, key, value };
  return value;
}

/** Detail before this day has been compacted ('' = nothing compacted). */
export async function compactedBefore(db: AscendDB): Promise<DayString> {
  let cutoff = '';
  for (const c of await db.compactions.toArray()) {
    if (c.deleted_at === null && c.cutoff_day > cutoff) cutoff = c.cutoff_day;
  }
  return cutoff;
}
