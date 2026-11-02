import type { QuestInstance } from '@/core/db/types';
import { isDone } from './progress';

/**
 * Day evaluation (pure) — SPEC 4.8 "Active day" and "Daily Clear".
 * Only daily quests (habit instances) count; weekly, side and recovery quests never do.
 * The core flag comes from each instance's snapshot, so later edits never change history.
 */
export interface DayEvaluation {
  /** No core quest was scheduled (e.g. a rest day): neither breaks nor extends the streak. */
  neutral: boolean;
  /** Every core quest done at least at minimum (late wake-up counts). */
  active: boolean;
  /** Every required daily quest done at least at minimum. Low energy: core quests only. */
  dailyClear: boolean;
}

type EvalInstance = Pick<QuestInstance, 'source_type' | 'status' | 'core_snapshot' | 'deleted_at'>;

export function evaluateDay(instances: EvalInstance[], lowEnergy: boolean): DayEvaluation {
  const daily = instances.filter((i) => i.source_type === 'habit' && i.deleted_at === null);
  const core = daily.filter((i) => i.core_snapshot);
  const neutral = core.length === 0;
  const active = !neutral && core.every((i) => isDone(i.status));
  const required = lowEnergy ? core : daily;
  const dailyClear = required.length > 0 && required.every((i) => isDone(i.status));
  return { neutral, active, dailyClear };
}

/** Low energy hides non-core quests; they can be shown again with one tap. */
export function visibleOnLowEnergy(instance: EvalInstance): boolean {
  return instance.source_type !== 'habit' || instance.core_snapshot || isDone(instance.status);
}
