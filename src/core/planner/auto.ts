import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { recordAction, subscribe, type DomainEvents } from '@/core/pipeline';
import { planMilestoneWeek, planStatusChange } from './followups';
import { loadPlannerState } from './state';
import type { ProposalItem } from './types';

/**
 * The planner reacting to meaningful goal changes (SPEC 6.3): status changes propose what to
 * do with linked quests; a new or changed active milestone gets its week planned. Creating a
 * main quest or moving its deadline opens the interview instead (that needs Rishi's answers).
 * Changes made by an applied plan are ignored, so the planner never reacts to itself.
 */
const STATUSES = ['active', 'paused', 'done', 'archived'] as const;
type Status = (typeof STATUSES)[number];

async function propose(
  database: AscendDB,
  goal: { type: 'dream' | 'main_quest' | 'milestone'; id: string },
  trigger: string,
  summary: string,
  items: ProposalItem[],
) {
  if (items.length === 0) return;
  await recordAction(
    {
      type: 'plan.propose',
      source: 'planner',
      payload: { goal_type: goal.type, goal_id: goal.id, trigger, summary, items },
    },
    { db: database },
  );
}

export async function reactToGoalChange(
  database: AscendDB,
  e: DomainEvents['GoalChanged'],
): Promise<void> {
  if (!e.meaningful || e.source === 'planner') return;
  const state = await loadPlannerState(database);

  if (
    (e.goalType === 'dream' || e.goalType === 'main_quest') &&
    STATUSES.includes(e.change as Status)
  ) {
    const status = e.change as Status;
    const verb = { active: 'resumed', paused: 'paused', done: 'finished', archived: 'archived' }[
      status
    ];
    if (e.goalType === 'main_quest') {
      const record = state.mainQuests.find((q) => q.id === e.goalId);
      if (!record) return;
      const items = planStatusChange(state, { type: 'main_quest', record }, status);
      await propose(
        database,
        { type: 'main_quest', id: record.id },
        `status:${status}`,
        `${record.title} was ${verb} — what about its quests?`,
        items,
      );
    } else {
      const record = await database.dreams.get(e.goalId);
      if (!record) return;
      const items = planStatusChange(state, { type: 'dream', record }, status, state.mainQuests);
      await propose(
        database,
        { type: 'dream', id: record.id },
        `status:${status}`,
        `${record.title} was ${verb} — its main quests and quests:`,
        items,
      );
    }
    return;
  }

  if (
    e.goalType === 'milestone' &&
    (e.change === 'created' || e.change === 'updated' || e.change === 'active')
  ) {
    const milestone = state.milestones.find((m) => m.id === e.goalId);
    if (!milestone || milestone.status !== 'active') return;
    const goal = state.mainQuests.find((q) => q.id === milestone.main_quest_id);
    if (!goal || goal.status !== 'active') return;
    const items = planMilestoneWeek(state, milestone, goal);
    await propose(
      database,
      { type: 'main_quest', id: goal.id },
      'milestone',
      `This week’s quests for “${milestone.title}”.`,
      items,
    );
  }
}

/** Starts listening. Returns a stop function. */
export function startAutoPlanner(database: AscendDB = defaultDb): () => void {
  return subscribe('GoalChanged', (e) =>
    reactToGoalChange(database, e).catch((error: unknown) => {
      logError(error, 'auto-planner');
    }),
  );
}
