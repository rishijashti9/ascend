import type { AscendDB } from '@/core/db/db';

/**
 * Everything ASCEND ever sends outside the user's own device and account (SPEC 6.7 D): only
 * "Ask the System" questions to the AI service (OpenRouter since 2026-11-04, Gemini before). Logged on this device (meta `outbound_log`), newest
 * last, the last 200 kept. Content isn't stored — just when, where and how much.
 */
export interface OutboundEntry {
  at: string;
  service: 'openrouter' | 'gemini';
  /** What kind of request (e.g. `ask`). */
  kind: string;
  /** Characters sent. */
  chars: number;
}

export const OUTBOUND_KEY = 'outbound_log';
export const OUTBOUND_KEEP = 200;

export async function readOutbound(db: AscendDB): Promise<OutboundEntry[]> {
  const v = (await db.meta.get(OUTBOUND_KEY))?.value;
  return Array.isArray(v) ? (v as OutboundEntry[]) : [];
}
