/**
 * Sync conflict rules (SPEC 9) — the same rules as `sync_incoming_wins` in
 * supabase/migrations (latest: …_instance_merge.sql); a test runs both on the same cases.
 */

/** Local tables that sync. Never: photos (device-only), meta (device state), pending_actions. */
export const SYNCED_TABLES = [
  'profile',
  'settings',
  'dreams',
  'main_quests',
  'milestones',
  'habits',
  'quests',
  'quest_instances',
  'progress_entries',
  'days',
  'focus_sessions',
  'body_logs',
  'reviews',
  'xp_events',
  'achievements_unlocked',
  'skills',
  'skill_evidence',
  'job_applications',
  'plan_history',
  'plan_proposals',
  'learning_events',
  'summaries',
  'compactions',
  'screen_days',
  'screen_rules',
  'screen_locks',
  'screen_events',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

/** Tables the server accepts only from schema version 2 (migration …_phase8_tables.sql). */
export const V2_TABLES = ['learning_events', 'summaries', 'compactions'] as const;
export type V2Table = (typeof V2_TABLES)[number];

/** Tables the server accepts only from schema version 3 (migration …_phase11_screen_time.sql). */
export const V3_TABLES = ['screen_days', 'screen_rules', 'screen_locks', 'screen_events'] as const;

/** The newest server schema version this app knows. */
export const SERVER_VERSION = 3;

/** The server version from which a table is accepted (older tables: 1). */
export function tableServerVersion(tbl: string): number {
  if ((V3_TABLES as readonly string[]).includes(tbl)) return 3;
  if ((V2_TABLES as readonly string[]).includes(tbl)) return 2;
  return 1;
}

const RANK: Record<string, number> = { done_full: 3, done_min: 2, done_late: 1 };

/** The HLC with its physical time capped at when the server received it. */
export function sortKey(hlc: string, receivedMs: number): string {
  const ms = Math.min(Number(hlc.slice(0, 15)), receivedMs);
  return String(ms).padStart(15, '0') + hlc.slice(15);
}

type Data = Record<string, unknown>;

/** Does an incoming version of a record replace the stored one? */
export function incomingWins(
  tbl: string,
  oldData: Data,
  oldSort: string,
  newData: Data,
  newSort: string,
): boolean {
  if (tbl === 'xp_events') return false; // append-only
  if (tbl === 'days') {
    // Only the low-energy choice travels; the rest of a day is recomputed on each device.
    const o = String(oldData.low_energy_set_at ?? '');
    const n = String(newData.low_energy_set_at ?? '');
    return n > o || (n === o && newSort > oldSort);
  }
  if (tbl === 'screen_locks') {
    // A lock only ever gets longer (SPEC 6.8): the copy that ends later wins.
    const o = String(oldData.end_at ?? '');
    const n = String(newData.end_at ?? '');
    if (n !== o) return n > o;
  }
  if (tbl === 'quest_instances') {
    // By what happened, not by clocks: a deliberate un-tick (higher revision) wins; within a
    // revision progress only goes up, so more progress wins (a completion beats pending/missed).
    const oldRev = Number(oldData.award_revision ?? 0);
    const newRev = Number(newData.award_revision ?? 0);
    if (newRev !== oldRev) return newRev > oldRev;
    const oldRank = RANK[String(oldData.status)] ?? 0;
    const newRank = RANK[String(newData.status)] ?? 0;
    if (newRank !== oldRank) return newRank > oldRank;
  }
  return newSort > oldSort;
}
