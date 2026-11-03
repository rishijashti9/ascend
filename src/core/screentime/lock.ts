import type { ScreenLock, ScreenRules, ScreenRuleValues } from '@/core/db/types';

/**
 * Lock rules (SPEC 6.8 "Lock") — a deliberate exception to principle 8. Pure functions.
 *
 * - A lock ends only when **trusted time** (the latest server clock ASCEND has seen) passes its
 *   end. The device clock alone never ends a lock: moved forward it changes nothing, moved back
 *   it only makes the lock look longer. Offline, a lock simply stays on until a server is seen.
 * - Its end only moves later: accepting/changing the limit → at least now + 1 week (or 1 month);
 *   each incident → +7 days.
 * - During a lock stricter changes apply at once; looser ones wait in `pending`.
 */
export const DAY_MS = 86_400_000;
export const LOCK_DAYS = { week: 7, month: 30 } as const;
export type LockLength = keyof typeof LOCK_DAYS;
export const INCIDENT_DAYS = 7;

export function lockEndMs(lock: Pick<ScreenLock, 'end_at'> | null | undefined): number | null {
  if (!lock) return null;
  const ms = Date.parse(lock.end_at);
  return Number.isFinite(ms) ? ms : null;
}

/** Is the lock still on? `trustedMs` = latest server time seen (null = none seen yet). */
export function lockActive(
  lock: Pick<ScreenLock, 'end_at' | 'deleted_at'> | null | undefined,
  trustedMs: number | null,
): boolean {
  const end = lockEndMs(lock);
  if (end === null || lock?.deleted_at) return false;
  return trustedMs === null || trustedMs < end;
}

/** "Now" for starting/extending a lock: never earlier than the server time already seen. */
export function lockNow(deviceMs: number, trustedMs: number | null): number {
  return Math.max(deviceMs, trustedMs ?? 0);
}

/** New end after accepting/changing the limit (never earlier than the current end). */
export function extendedEnd(
  currentEndMs: number | null,
  nowMs: number,
  length: LockLength,
): number {
  return Math.max(currentEndMs ?? 0, nowMs + LOCK_DAYS[length] * DAY_MS);
}

/** New end after an incident. */
export function incidentEnd(currentEndMs: number): number {
  return currentEndMs + INCIDENT_DAYS * DAY_MS;
}

/** Of two copies of the lock (sync, import), keep the one that ends later. */
export function laterLock<T extends Pick<ScreenLock, 'end_at'>>(
  a: T | undefined,
  b: T | undefined,
): T | undefined {
  if (!a) return b;
  if (!b) return a;
  return (lockEndMs(b) ?? 0) > (lockEndMs(a) ?? 0) ? b : a;
}

export type RuleChange =
  | { kind: 'limit'; limit_min: number | null }
  | { kind: 'reminders'; on: boolean }
  | { kind: 'enabled'; on: boolean }
  | { kind: 'add_app'; pkg: string }
  | { kind: 'remove_app'; pkg: string };

export type RulesState = Pick<ScreenRules, keyof ScreenRuleValues | 'enabled' | 'pending'>;

/** Is a change looser than the current rules (so it waits for the lock to end)? */
export function isLooser(rules: RulesState, change: RuleChange): boolean {
  switch (change.kind) {
    case 'limit':
      if (rules.limit_min === null) return false; // no limit yet: setting one is stricter
      return change.limit_min === null || change.limit_min > rules.limit_min;
    case 'reminders':
      return rules.reminders && !change.on;
    case 'enabled':
      return rules.enabled && !change.on;
    case 'add_app':
      return false;
    case 'remove_app':
      return true;
  }
}

function withoutPending(
  pending: RulesState['pending'],
  key: 'limit_min' | 'reminders' | 'enabled',
): RulesState['pending'] {
  if (!pending || !(key in pending)) return pending;
  const next = Object.fromEntries(
    Object.entries(pending).filter(([k]) => k !== key),
  ) as NonNullable<RulesState['pending']>;
  return Object.keys(next).length ? next : null;
}

/** The rules with one change applied right away (no lock, or a stricter change). */
function applyNow(rules: RulesState, change: RuleChange): RulesState {
  switch (change.kind) {
    case 'limit':
      return {
        ...rules,
        limit_min: change.limit_min,
        pending: withoutPending(rules.pending, 'limit_min'),
      };
    case 'reminders':
      return {
        ...rules,
        reminders: change.on,
        pending: withoutPending(rules.pending, 'reminders'),
      };
    case 'enabled':
      return { ...rules, enabled: change.on, pending: withoutPending(rules.pending, 'enabled') };
    case 'add_app': {
      const pendingRemoved = (rules.pending?.removed_apps ?? []).filter((p) => p !== change.pkg);
      let pending = rules.pending ? { ...rules.pending } : null;
      if (pending) {
        if (pendingRemoved.length) pending.removed_apps = pendingRemoved;
        else delete pending.removed_apps;
        if (!Object.keys(pending).length) pending = null;
      }
      return {
        ...rules,
        removed_apps: rules.removed_apps.filter((p) => p !== change.pkg),
        added_apps: rules.added_apps.includes(change.pkg)
          ? rules.added_apps
          : [...rules.added_apps, change.pkg],
        pending,
      };
    }
    case 'remove_app':
      return {
        ...rules,
        added_apps: rules.added_apps.filter((p) => p !== change.pkg),
        removed_apps: rules.removed_apps.includes(change.pkg)
          ? rules.removed_apps
          : [...rules.removed_apps, change.pkg],
      };
  }
}

/** The rules with a looser change saved for when the lock ends. */
function deferChange(rules: RulesState, change: RuleChange): RulesState {
  const pending = { ...(rules.pending ?? {}) };
  switch (change.kind) {
    case 'limit':
      pending.limit_min = change.limit_min;
      break;
    case 'reminders':
      pending.reminders = change.on;
      break;
    case 'enabled':
      pending.enabled = change.on;
      break;
    case 'remove_app':
      pending.removed_apps = [...new Set([...(pending.removed_apps ?? []), change.pkg])];
      break;
    case 'add_app':
      break;
  }
  return { ...rules, pending };
}

/** Applies a change under the lock rules: `deferred` = it waits for the lock to end. */
export function changeRules(
  rules: RulesState,
  change: RuleChange,
  locked: boolean,
): { rules: RulesState; deferred: boolean } {
  if (locked && isLooser(rules, change))
    return { rules: deferChange(rules, change), deferred: true };
  return { rules: applyNow(rules, change), deferred: false };
}

/** When the lock has ended: every waiting change takes effect. */
export function applyPending(rules: RulesState): RulesState {
  const p = rules.pending;
  if (!p) return rules;
  let next: RulesState = { ...rules, pending: null };
  if ('limit_min' in p) next = applyNow(next, { kind: 'limit', limit_min: p.limit_min ?? null });
  if (p.reminders !== undefined) next = applyNow(next, { kind: 'reminders', on: p.reminders });
  if (p.enabled !== undefined) next = applyNow(next, { kind: 'enabled', on: p.enabled });
  for (const pkg of p.removed_apps ?? []) next = applyNow(next, { kind: 'remove_app', pkg });
  return next;
}

/**
 * Of two versions of the rules (import of a backup during a lock), the stricter of each value:
 * a lower limit, reminders on, screen time on, the union of added apps, and only removals both
 * agree on. Waiting changes are kept from the current rules.
 */
export function stricterRules(current: RulesState, other: RulesState): RulesState {
  const limits = [current.limit_min, other.limit_min].filter((v): v is number => v !== null);
  return {
    ...current,
    enabled: current.enabled || other.enabled,
    reminders: current.reminders || other.reminders,
    limit_min: limits.length ? Math.min(...limits) : null,
    added_apps: [...new Set([...current.added_apps, ...other.added_apps])],
    removed_apps: current.removed_apps.filter(
      (p) => other.removed_apps.includes(p) && !other.added_apps.includes(p),
    ),
  };
}
