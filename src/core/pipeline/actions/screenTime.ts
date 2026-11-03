import { z } from 'zod';
import {
  applyPending,
  changeRules,
  extendedEnd,
  lockActive,
  lockEndMs,
  lockNow,
  type LockLength,
  type RuleChange,
} from '@/core/screentime/lock';
import { BREAK_MS, canTakeBreak, MAX_BREAKS_PER_DAY } from '@/core/screentime/reminders';
import {
  getLock,
  getRules,
  LOCK_ID,
  lockStatus,
  RULES_ID,
  rulesRecord,
  rulesState,
  type ScreenState,
} from '@/core/screentime/store';
import { SCREEN_META, trustedMs } from '@/core/screentime/trustedTime';
import { appDayOf } from '../helpers';
import { newBase, touch } from '../records';
import { defineAction, RuleError, type ActionContext } from '../registry';

/**
 * Screen time (SPEC 6.8). Every change to the rules, the lock, breaks and the daily totals goes
 * through these actions.
 */

/** Remembers the server's time for lock checks — only ever moves forward. */
export const noteServerTime = defineAction({
  type: 'screen.noteServerTime',
  schema: z.object({ ms: z.number().int().positive() }).strict(),
  tables: ['meta'],
  async run(ctx, { ms }) {
    const old = (await ctx.db.meta.get(SCREEN_META.trusted))?.value;
    if (typeof old === 'number' && old >= ms) return false;
    await ctx.db.meta.put({ id: SCREEN_META.trusted, value: ms });
    return true;
  },
});

// ---- Rules (task 11.4) ----

const RULE_TABLES = ['screen_rules', 'screen_locks', 'meta', 'settings'] as const;
type RuleTables = (typeof RULE_TABLES)[number][];
const pkg = z.string().regex(/^[A-Za-z0-9_.]{1,200}$/, 'not an app package name');

export interface RuleResult {
  /** The change waits for the lock to end. */
  deferred: boolean;
  /** When the lock ends (ms), or null without a lock. */
  lockEndMs: number | null;
}

async function saveRules(ctx: ActionContext, state: ScreenState): Promise<void> {
  const existing = await ctx.db.screen_rules.get(RULES_ID);
  const base = existing
    ? { ...existing, ...touch(ctx.processedAt) }
    : newBase(RULES_ID, ctx.processedAt);
  await ctx.db.screen_rules.put(rulesRecord({ ...base, deleted_at: null }, state));
}

/** Starts the lock, or moves its end later (never earlier). */
async function extendLock(ctx: ActionContext, length: LockLength): Promise<number> {
  const existing = await getLock(ctx.db);
  const now = lockNow(Date.parse(ctx.processedAt), await trustedMs(ctx.db));
  const end = extendedEnd(lockEndMs(existing), now, length);
  const started =
    existing && lockActive(existing, await trustedMs(ctx.db))
      ? existing.started_at
      : new Date(now).toISOString();
  const base = existing
    ? { ...existing, ...touch(ctx.processedAt) }
    : newBase(LOCK_ID, ctx.processedAt);
  await ctx.db.screen_locks.put({
    ...base,
    deleted_at: null,
    started_at: started,
    end_at: new Date(end).toISOString(),
  });
  return end;
}

/** One rule change under the lock rules; returns whether it waits. */
async function change(
  ctx: ActionContext,
  c: RuleChange,
  extra: Partial<ScreenState> = {},
): Promise<RuleResult> {
  const current = rulesState(await getRules(ctx.db));
  const status = await lockStatus(ctx.db);
  const { rules, deferred } = changeRules(current, c, status.active);
  await saveRules(ctx, { ...current, ...rules, ...extra });
  ctx.emit({ type: 'ScreenTimeChanged', payload: { change: c.kind } });
  return { deferred, lockEndMs: status.endMs };
}

/** Screen time on (the observe week starts the first time) or off (off waits for the lock). */
export const setScreenTimeEnabled = defineAction({
  type: 'screen.setEnabled',
  schema: z.object({ on: z.boolean() }).strict(),
  tables: [...RULE_TABLES] as RuleTables,
  async run(ctx, { on }): Promise<RuleResult> {
    const current = await getRules(ctx.db);
    const observe =
      current?.observe_start_day ?? (on ? await appDayOf(ctx.db, ctx.occurredAt) : null);
    return change(ctx, { kind: 'enabled', on }, { observe_start_day: observe });
  },
});

/**
 * Accept the suggestion or change the limit (SPEC 6.8). Applied (a first limit, or a lower one,
 * or any change without a lock) → the lock starts or is extended to at least 1 week / 1 month
 * from now. A higher limit during a lock waits, and doesn't extend it.
 */
export const setScreenLimit = defineAction({
  type: 'screen.setLimit',
  schema: z
    .object({
      limit_min: z.number().int().min(5).max(1440),
      lock: z.enum(['week', 'month']).default('week'),
    })
    .strict(),
  tables: [...RULE_TABLES, 'habits', 'quest_instances'] as RuleTables,
  async run(ctx, { limit_min, lock }): Promise<RuleResult> {
    const r = await change(ctx, { kind: 'limit', limit_min });
    if (r.deferred) return r;
    return { deferred: false, lockEndMs: await extendLock(ctx, lock) };
  },
});

export const setScreenReminders = defineAction({
  type: 'screen.setReminders',
  schema: z.object({ on: z.boolean() }).strict(),
  tables: [...RULE_TABLES] as RuleTables,
  run: (ctx, { on }) => change(ctx, { kind: 'reminders', on }),
});

export const addScreenApp = defineAction({
  type: 'screen.addApp',
  schema: z.object({ pkg }).strict(),
  tables: [...RULE_TABLES] as RuleTables,
  run: (ctx, p) => change(ctx, { kind: 'add_app', pkg: p.pkg }),
});

export const removeScreenApp = defineAction({
  type: 'screen.removeApp',
  schema: z.object({ pkg }).strict(),
  tables: [...RULE_TABLES] as RuleTables,
  run: (ctx, p) => change(ctx, { kind: 'remove_app', pkg: p.pkg }),
});

/** When the lock has ended (by server time): waiting changes take effect. Run at startup. */
export const applyScreenPending = defineAction({
  type: 'screen.applyPending',
  schema: z.object({}).strict(),
  tables: [...RULE_TABLES] as RuleTables,
  async run(ctx): Promise<boolean> {
    const stored = await getRules(ctx.db);
    if (!stored?.pending) return false;
    if ((await lockStatus(ctx.db)).active) return false;
    await saveRules(ctx, { ...rulesState(stored), ...applyPending(rulesState(stored)) });
    ctx.emit({ type: 'ScreenTimeChanged', payload: { change: 'pending_applied' } });
    return true;
  },
});

/** "I'm on a break": reminders pause 20 minutes, at most twice a day. */
export const takeScreenBreak = defineAction({
  type: 'screen.takeBreak',
  schema: z.object({}).strict(),
  tables: ['screen_events', 'settings'],
  async run(ctx): Promise<{ untilMs: number; left: number }> {
    const day = await appDayOf(ctx.db, ctx.occurredAt);
    const today = await ctx.db.screen_events
      .where('day')
      .equals(day)
      .filter((e) => e.kind === 'break' && !e.deleted_at)
      .count();
    if (!canTakeBreak(today)) throw new RuleError('Both breaks for today are used.');
    await ctx.db.screen_events.add({
      ...newBase(undefined, ctx.processedAt),
      kind: 'break',
      day,
      at: ctx.occurredAt,
    });
    ctx.emit({ type: 'ScreenTimeChanged', payload: { change: 'break' } });
    return { untilMs: Date.parse(ctx.occurredAt) + BREAK_MS, left: MAX_BREAKS_PER_DAY - today - 1 };
  },
});

// ---- Daily totals (task 11.6 writes them from the phone) ----

const seconds = z.record(
  pkg,
  z
    .number()
    .int()
    .min(0)
    .max(86_400 * 2),
);

/** One device's totals for one day (replaces that device's earlier reading). */
export const saveScreenDay = defineAction({
  type: 'screen.saveDay',
  schema: z
    .object({
      device_id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      apps: seconds,
      focus: seconds,
      labels: z.record(pkg, z.string().max(120)),
      games: z.array(pkg).max(2000),
    })
    .strict(),
  tables: ['screen_days'],
  async run(ctx, p): Promise<boolean> {
    const id = `${p.device_id}:${p.day}`;
    const existing = await ctx.db.screen_days.get(id);
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    if (
      existing &&
      !existing.deleted_at &&
      same(existing.apps, p.apps) &&
      same(existing.focus, p.focus) &&
      same(existing.labels, p.labels) &&
      same([...existing.games].sort(), [...p.games].sort())
    )
      return false;
    const base = existing
      ? { ...existing, ...touch(ctx.processedAt) }
      : newBase(id, ctx.processedAt);
    await ctx.db.screen_days.put({ ...base, deleted_at: null, ...p });
    ctx.emit({ type: 'ScreenTimeChanged', payload: { change: 'day' } });
    return true;
  },
});
