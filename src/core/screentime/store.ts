import type { AscendDB } from '@/core/db/db';
import type { BaseRecord, ScreenLock, ScreenRules } from '@/core/db/types';
import { lockActive, lockEndMs, type RulesState } from './lock';
import { trustedMs } from './trustedTime';

/**
 * Reading the screen-time records (Dexie only, so safe inside action transactions). The rules
 * record is created the first time screen time is switched on — until then nothing is stored.
 */
export const RULES_ID = 'screen_rules';
export const LOCK_ID = 'screen_lock';

/** The rules' values plus the observe-week start. */
export type ScreenState = RulesState & Pick<ScreenRules, 'observe_start_day'>;

export const DEFAULT_RULES: ScreenState = {
  enabled: false,
  reminders: true,
  limit_min: null,
  added_apps: [],
  removed_apps: [],
  pending: null,
  observe_start_day: null,
};

export async function getRules(db: AscendDB): Promise<ScreenRules | undefined> {
  const r = await db.screen_rules.get(RULES_ID);
  return r && !r.deleted_at ? r : undefined;
}

/** The rules' values, or the defaults when screen time was never switched on. */
export function rulesState(
  r: ScreenRules | undefined,
): RulesState & Pick<ScreenRules, 'observe_start_day'> {
  if (!r) return { ...DEFAULT_RULES };
  return {
    enabled: r.enabled,
    reminders: r.reminders,
    limit_min: r.limit_min,
    added_apps: r.added_apps,
    removed_apps: r.removed_apps,
    pending: r.pending,
    observe_start_day: r.observe_start_day,
  };
}

export async function getLock(db: AscendDB): Promise<ScreenLock | undefined> {
  const l = await db.screen_locks.get(LOCK_ID);
  return l && !l.deleted_at ? l : undefined;
}

export interface LockStatus {
  active: boolean;
  /** When it ends (ms), shown as the date waiting changes take effect. */
  endMs: number | null;
}

export async function lockStatus(db: AscendDB): Promise<LockStatus> {
  const lock = await getLock(db);
  return { active: lockActive(lock, await trustedMs(db)), endMs: lockEndMs(lock) };
}

/** Merges the stored rules with new values into a full record. */
export function rulesRecord(
  base: BaseRecord,
  state: RulesState & Pick<ScreenRules, 'observe_start_day'>,
): ScreenRules {
  return { ...base, ...state };
}
