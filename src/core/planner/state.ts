import type { AscendDB } from '@/core/db/db';
import { addDays, currentTimeZone, dayOf, nowMs, weekStartOf } from '@/core/time';
import type { PlannerState } from './analyze';

/** Reads everything the planner looks at (one read transaction, a consistent snapshot). */
export async function loadPlannerState(db: AscendDB): Promise<PlannerState> {
  return db.transaction(
    'r',
    ['settings', 'main_quests', 'milestones', 'habits', 'quests', 'quest_instances'],
    async () => {
      const settings = await db.settings.get('settings');
      const today = dayOf(nowMs(), currentTimeZone(), settings?.day_start_hour ?? 3);
      const live = <T extends { deleted_at: string | null }>(rows: T[]) =>
        rows.filter((r) => r.deleted_at === null);
      return {
        today,
        weekStart: weekStartOf(today, settings?.week_start ?? 1),
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
