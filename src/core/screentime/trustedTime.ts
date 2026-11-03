import type { AscendDB } from '@/core/db/db';
import { recordAction } from '@/core/pipeline';
import { getSupabase } from '@/core/sync/client';

/**
 * Trusted time for screen-time locks (SPEC 6.8): the latest server clock ASCEND has seen. A lock
 * ends only when this passes its end, so changing the phone's clock never unlocks it. It needs
 * no account (`server_time()` is public) — just a connection now and then.
 */
export const SCREEN_META = {
  /** Latest server time seen (ms). Device-local (`meta` never syncs). */
  trusted: 'screen:trusted_ms',
} as const;

export async function trustedMs(db: AscendDB): Promise<number | null> {
  const v = (await db.meta.get(SCREEN_META.trusted))?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

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
