import type { MainQuest, Milestone, PlanProposal } from '@/core/db/types';

/**
 * Where a main quest stands in "goal → plan → execution" (UX-4, docs/product/AUDIT-AND-
 * PROPOSAL.md P5). ONE definition, used by the Goals cards and by Today's "Goals that need a
 * look", so the two can never disagree about which goal needs a plan.
 */
export type PlanState =
  | { kind: 'done' }
  | { kind: 'inactive' } // paused or archived: nothing to plan right now
  | { kind: 'unplanned' }
  | { kind: 'waiting' } // the planner made a plan; it's waiting for approval
  | { kind: 'next'; milestone: Milestone }
  | { kind: 'planned' }; // has milestones, none active right now

export function planState(
  quest: MainQuest,
  milestones: readonly Milestone[],
  proposals: readonly PlanProposal[],
): PlanState {
  if (quest.status === 'done') return { kind: 'done' };
  if (quest.status !== 'active') return { kind: 'inactive' };
  const own = milestones.filter((m) => m.main_quest_id === quest.id && m.status !== 'archived');
  // `proposals` holds the pending ones (goals store).
  if (proposals.some((p) => p.goal_id === quest.id)) return { kind: 'waiting' };
  if (own.length === 0) return { kind: 'unplanned' };
  const active = own.filter((m) => m.status === 'active').sort((a, b) => a.order - b.order)[0];
  return active ? { kind: 'next', milestone: active } : { kind: 'planned' };
}

/** Today's "needs a plan" rule (kept identical to `planState(...).kind === 'unplanned'`). */
export const needsPlan = (
  quest: MainQuest,
  milestones: readonly Milestone[],
  proposals: readonly PlanProposal[],
): boolean => planState(quest, milestones, proposals).kind === 'unplanned';
