/**
 * Sync conflict rules (SPEC 9) — the same rules as `sync_incoming_wins` in
 * supabase/migrations/…_sync_records.sql (a test runs both on the same cases).
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
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

const DONE = new Set(['done_full', 'done_min', 'done_late']);

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
  if (tbl === 'quest_instances') {
    if (oldData.status === 'missed' && DONE.has(String(newData.status))) return true;
    if (newData.status === 'missed' && DONE.has(String(oldData.status))) return false;
  }
  return newSort > oldSort;
}
