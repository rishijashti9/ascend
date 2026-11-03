import type { AscendDB } from '@/core/db/db';
import { loadAdaptiveInput } from '@/core/adaptive/load';
import { weeklyCapacity } from '@/core/adaptive/patterns';
import { jobStats } from '@/core/engine/jobs';
import { goalsStore } from '@/core/state/goals';
import { addDays, currentTimeZone, dayOf, nowMs, weekStartOf } from '@/core/time';
import type { PlannerState } from './analyze';

/** Reads everything the planner looks at (one read transaction, a consistent snapshot). */
export async function loadPlannerState(db: AscendDB): Promise<PlannerState> {
  const state = await readPlannerState(db);
  // Real weekly capacity from the last 8 weeks (Adaptive System).
  const capacity = weeklyCapacity(await loadAdaptiveInput(db, currentTimeZone(), CAPACITY_DAYS));
  return { ...state, capacity, focusGoalId: goalsStore.getState().focusGoal?.mainQuestId ?? null };
}

const CAPACITY_DAYS = 56;

async function readPlannerState(db: AscendDB): Promise<PlannerState> {
  return db.transaction(
    'r',
    [
      'settings',
      'main_quests',
      'milestones',
      'habits',
      'quests',
      'quest_instances',
      'job_applications',
    ],
    async () => {
      const settings = await db.settings.get('settings');
      const today = dayOf(nowMs(), currentTimeZone(), settings?.day_start_hour ?? 3);
      const live = <T extends { deleted_at: string | null }>(rows: T[]) =>
        rows.filter((r) => r.deleted_at === null);
      const weekStartsOn = settings?.week_start ?? 1;
      return {
        today,
        weekStart: weekStartOf(today, weekStartsOn),
        jobStats: settings?.jobs_enabled
          ? jobStats(await db.job_applications.toArray(), today, weekStartsOn)
          : null,
        mainQuests: live(await db.main_quests.toArray()),
        milestones: live(await db.milestones.toArray()),
        habits: live(await db.habits.toArray()),
        quests: live(await db.quests.toArray()),
        instances: await db.quest_instances
          .where('day')
          .between(addDays(today, -15), today, true, false)
          .toArray(),
      };
    },
  );
}
