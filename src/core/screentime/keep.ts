import type { AscendDB } from '@/core/db/db';
import type { IsoTime, ScreenLock, ScreenRules } from '@/core/db/types';
import { touch } from '@/core/pipeline/records';
import { laterLock, lockActive, stricterRules } from './lock';
import { getLock, getRules, rulesRecord, rulesState } from './store';
import { trustedMs } from './trustedTime';

/**
 * Importing a backup never unlocks (SPEC 6.8): before an import the current lock and rules are
 * captured; afterwards the later lock is kept, and while it is on, the stricter of each rule.
 * Dexie only — runs inside the import's transaction.
 */
export interface ScreenGuard {
  lock: ScreenLock | undefined;
  rules: ScreenRules | undefined;
}

export async function captureScreenGuard(db: AscendDB): Promise<ScreenGuard> {
  return { lock: await getLock(db), rules: await getRules(db) };
}

export async function restoreScreenGuard(
  db: AscendDB,
  before: ScreenGuard,
  at: IsoTime,
): Promise<void> {
  const now = { lock: await getLock(db), rules: await getRules(db) };
  const lock = laterLock(before.lock, now.lock);
  if (lock && lock.end_at !== now.lock?.end_at) {
    await db.screen_locks.put({ ...lock, ...touch(at), deleted_at: null });
  }
  if (!before.rules || !lockActive(lock, await trustedMs(db))) return;
  const kept = rulesState(before.rules);
  const strict = stricterRules(kept, rulesState(now.rules));
  const next = { ...strict, observe_start_day: kept.observe_start_day, pending: kept.pending };
  if (now.rules && JSON.stringify(rulesState(now.rules)) === JSON.stringify(next)) return;
  await db.screen_rules.put(rulesRecord({ ...before.rules, ...touch(at), deleted_at: null }, next));
}
