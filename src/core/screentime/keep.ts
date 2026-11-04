import type { AscendDB } from '@/core/db/db';
import type { IsoTime, ScreenLock, ScreenRules } from '@/core/db/types';
import { touch } from '@/core/pipeline/records';
import { laterLock, lockActive, stricterRules } from './lock';
import { getLock, getRules, rulesRecord, rulesState } from './store';
import { SCREEN_META, trustedMs } from './trustedTime';
import { nowMs } from '@/core/time';

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

/**
 * "Delete everything" and "Reset all data" delete the whole local database — but never an
 * active lock (SPEC 6.8). The lock and its rules are put aside in localStorage just before, and
 * put back when the database opens again (with new sync clocks, so they sync up again).
 */
const STASH_KEY = 'ascend.screenLock';

export async function stashActiveLock(db: AscendDB): Promise<void> {
  const guard = await captureScreenGuard(db);
  const trusted = await trustedMs(db);
  if (!lockActive(guard.lock, trusted)) return;
  try {
    localStorage.setItem(STASH_KEY, JSON.stringify({ ...guard, trusted }));
  } catch {
    // Storage blocked: nothing can be kept (the cloud copy still has the lock if synced).
  }
}

export async function restoreStashedLock(db: AscendDB): Promise<boolean> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STASH_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;
  const saved = JSON.parse(raw) as ScreenGuard & { trusted: number | null };
  await db.transaction('rw', [db.screen_locks, db.screen_rules, db.meta], async () => {
    if (saved.trusted !== null && (await trustedMs(db)) === null) {
      await db.meta.put({ id: SCREEN_META.trusted, value: saved.trusted });
    }
    await restoreScreenGuard(db, saved, new Date(nowMs()).toISOString());
  });
  try {
    localStorage.removeItem(STASH_KEY);
  } catch {
    // ignore
  }
  return true;
}
