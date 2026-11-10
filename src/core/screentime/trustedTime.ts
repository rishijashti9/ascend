import type { AscendDB } from '@/core/db/db';

/**
 * Trusted time for screen-time locks (SPEC 6.8): the latest server clock ASCEND has seen. A lock
 * ends only when this passes its end, so changing the phone's clock never unlocks it. It needs
 * no account (`server_time()` is public) — just a connection now and then.
 *
 * Read-only on purpose: pipeline actions import this file, so it must not import the pipeline.
 * Fetching and saving the server time lives in `serverTime.ts`.
 */
export const SCREEN_META = {
  /** Latest server time seen (ms). Device-local (`meta` never syncs). */
  trusted: 'screen:trusted_ms',
} as const;

export async function trustedMs(db: AscendDB): Promise<number | null> {
  const v = (await db.meta.get(SCREEN_META.trusted))?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
