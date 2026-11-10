import type { AscendDB } from '@/core/db/db';
import { recordAction } from '@/core/pipeline';
import { getSupabase } from '@/core/sync/client';
import { trustedMs } from './trustedTime';

/**
 * Learning the server time for screen-time locks (SPEC 6.8). Kept apart from `trustedTime.ts`,
 * which the pipeline's own actions import: this file writes through `recordAction`, so living
 * there would make the pipeline import itself.
 */

const TIMEOUT_MS = 8_000;

/** Asks the server for its time. Null when offline, not set up, or the migration is missing. */
export async function fetchServerTime(): Promise<number | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const call = client.rpc('server_time');
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
    const res = await Promise.race([call, timeout]);
    if (!res || res.error || typeof res.data !== 'string') return null;
    const ms = Date.parse(res.data);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

/** Fetches the server time and remembers it (only ever moves forward). */
export async function refreshTrustedTime(db: AscendDB): Promise<number | null> {
  const ms = await fetchServerTime();
  if (ms !== null) {
    await recordAction(
      { type: 'screen.noteServerTime', source: 'system', payload: { ms } },
      { db },
    );
  }
  return trustedMs(db);
}
