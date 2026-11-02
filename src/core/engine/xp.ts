import { GAME } from '@/config/game';
import type { Difficulty, InstanceStatus, Stat, XpEvent, XpReason } from '@/core/db/types';
import { STATS } from '@/core/db/types';

/**
 * XP engine (pure) — SPEC 4.8 "XP — order of operations".
 * xp_events store only BASE awards. A day's real XP is computed here:
 *   0. drop award revisions that were cancelled by a same-day un-tick
 *   1. base amounts (already stored)
 *   2. streak bonus, from the streak at the START of the day
 *   3. soft cap: XP beyond the daily threshold is multiplied by the cap factor
 *   4. round (once per stat per day, so min + top-up always equals full)
 * Bonuses with no stat (Daily Clear and others) skip steps 2–3 and go to the player only.
 * Same events in any order, from any device → same result.
 */

export type AwardKind = 'full' | 'min' | 'late';

/** Base XP for completing a quest of `difficulty` at full, minimum, or as a late check-in. */
export function baseAward(difficulty: Difficulty, kind: AwardKind): number {
  const base = GAME.xpByDifficulty[difficulty];
  if (kind === 'min') return base * GAME.minFraction;
  if (kind === 'late') return base * GAME.lateFraction;
  return base;
}

export function streakMultiplier(streakAtStart: number): number {
  return 1 + Math.min(GAME.streakBonus.max, GAME.streakBonus.perDay * Math.max(0, streakAtStart));
}

/** `instance_id:reason:revision` — the same award written twice is stored once. */
export function awardKey(instanceId: string, reason: XpReason, revision: number): string {
  return `${instanceId}:${reason}:${revision}`;
}

/** Revision encoded in a quest award key (last segment), or null for other events. */
function revisionOf(event: Pick<XpEvent, 'idempotency_key'>): string | null {
  const last = event.idempotency_key.split(':').pop();
  return last !== undefined && /^\d+$/.test(last) ? last : null;
}

/** Events that still count: every award revision that has a correction is removed entirely. */
export function liveEvents<T extends Pick<XpEvent, 'reason' | 'ref_id' | 'idempotency_key'>>(
  events: T[],
): T[] {
  const cancelled = new Set<string>();
  for (const e of events) {
    if (e.reason === 'quest_correction') cancelled.add(`${e.ref_id}|${revisionOf(e)}`);
  }
  return events.filter((e) => !cancelled.has(`${e.ref_id}|${revisionOf(e)}`));
}

export interface DayXp {
  /** Final player XP for the day: stat XP + bonuses (+ Daily Clear if earned). */
  total: number;
  byStat: Record<Stat, number>;
  /** Player-only bonuses (no stat), including Daily Clear. */
  bonus: number;
}

type DayEvent = Pick<
  XpEvent,
  'occurred_at' | 'stat' | 'base_amount' | 'reason' | 'ref_id' | 'idempotency_key'
>;

export function computeDayXp(
  events: DayEvent[],
  streakAtStart: number,
  dailyClear: boolean,
): DayXp {
  const ordered = [...liveEvents(events)].sort(
    (a, b) =>
      a.occurred_at.localeCompare(b.occurred_at) ||
      a.idempotency_key.localeCompare(b.idempotency_key),
  );
  const multiplier = streakMultiplier(streakAtStart);
  const { threshold, factor } = GAME.softCap;
  const raw: Record<Stat, number> = { STR: 0, INT: 0, WIL: 0 };
  let bonus = dailyClear ? GAME.dailyClearBonus : 0;
  let counted = 0; // post-bonus XP so far today, for the soft cap

  for (const e of ordered) {
    if (e.stat === null) {
      bonus += e.base_amount;
      continue;
    }
    const withBonus = e.base_amount * multiplier;
    const belowCap = Math.max(0, Math.min(withBonus, threshold - counted));
    const capped = belowCap + (withBonus - belowCap) * factor;
    counted += withBonus;
    raw[e.stat] += capped;
  }

  const byStat = { STR: 0, INT: 0, WIL: 0 } as Record<Stat, number>;
  for (const s of STATS) byStat[s] = Math.round(raw[s]);
  const total = byStat.STR + byStat.INT + byStat.WIL + Math.round(bonus);
  return { total, byStat, bonus: Math.round(bonus) };
}

/** Net base award currently held by one instance (after cancelled revisions are dropped). */
export function netBaseFor(events: DayEvent[], instanceId: string): number {
  return liveEvents(events.filter((e) => e.ref_id === instanceId)).reduce(
    (sum, e) => sum + e.base_amount,
    0,
  );
}

const KIND_OF: Partial<Record<InstanceStatus, AwardKind>> = {
  done_full: 'full',
  done_min: 'min',
  done_late: 'late',
};

const REASON_OF: Record<AwardKind, XpReason> = {
  full: 'quest_full',
  min: 'quest_min',
  late: 'quest_late',
};

export interface PlannedAward {
  reason: XpReason;
  base_amount: number;
  idempotency_key: string;
}

/**
 * The XP events needed to move an instance from `from` to `to` (one net award per
 * instance per day). Returns the events plus the instance's new award revision.
 * - pending → done_*: one award
 * - done_min → done_full: top-up of the difference (never twice)
 * - done_* → pending (same-day un-tick): a correction cancelling the revision, revision + 1
 * Downgrades (full → min) are not allowed: progress only goes up.
 */
export function planAward(params: {
  instanceId: string;
  difficulty: Difficulty;
  from: InstanceStatus;
  to: InstanceStatus;
  revision: number;
  currentNetBase: number;
}): { awards: PlannedAward[]; revision: number } {
  const { instanceId, difficulty, from, to, revision, currentNetBase } = params;
  const fromKind = KIND_OF[from];
  const toKind = KIND_OF[to];

  if (from === to) return { awards: [], revision };

  if (to === 'pending') {
    if (!fromKind || currentNetBase === 0) return { awards: [], revision };
    return {
      awards: [
        {
          reason: 'quest_correction',
          base_amount: -currentNetBase,
          idempotency_key: awardKey(instanceId, 'quest_correction', revision),
        },
      ],
      revision: revision + 1,
    };
  }

  if (!toKind) throw new Error(`No XP award for status ${to}`);
  const target = baseAward(difficulty, toKind);

  if (!fromKind) {
    return {
      awards: [
        {
          reason: REASON_OF[toKind],
          base_amount: target,
          idempotency_key: awardKey(instanceId, REASON_OF[toKind], revision),
        },
      ],
      revision,
    };
  }

  const delta = target - currentNetBase;
  if (delta <= 0) throw new Error(`Cannot go from ${from} to ${to}: progress only goes up`);
  return {
    awards: [
      {
        reason: 'quest_topup',
        base_amount: delta,
        idempotency_key: awardKey(instanceId, 'quest_topup', revision),
      },
    ],
    revision,
  };
}
