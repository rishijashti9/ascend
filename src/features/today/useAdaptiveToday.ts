import { useMemo } from 'react';
import {
  atRiskToday,
  whatNow,
  type NextAction,
  type PendingQuest,
  type Risk,
} from '@/core/adaptive/today';
import { isDone } from '@/core/engine/progress';
import { useAdaptive } from '@/core/state/adaptive';
import { useGoals } from '@/core/state/goals';
import { useHabits } from '@/core/state/habits';
import { useToday } from '@/core/state/today';
import { currentTimeZone, localParts } from '@/core/time';
import { useNow } from '@/ui/hooks/useNow';

/** Today's at-risk quests (by instance id) and the one best next action. */
export function useAdaptiveToday(): { risks: Map<string, Risk>; next: NextAction | null } {
  const daily = useToday((s) => s.daily);
  const day = useToday((s) => s.day);
  const lowEnergy = useToday((s) => s.lowEnergy);
  const models = useAdaptive((s) => s.models);
  const focus = useAdaptive((s) => s.focus);
  const habits = useHabits((s) => s.habits);
  const milestones = useGoals((s) => s.milestones);
  const mainQuests = useGoals((s) => s.mainQuests);
  const now = useNow(60_000);
  const hour = localParts(now, currentTimeZone()).hour;

  return useMemo(() => {
    if (!day) return { risks: new Map(), next: null };
    const deadline = (habitId: string) => {
      const h = habits.find((x) => x.id === habitId);
      if (!h?.linked_goal_id) return null;
      if (h.linked_goal_type === 'milestone')
        return milestones.find((m) => m.id === h.linked_goal_id)?.target_date ?? null;
      if (h.linked_goal_type === 'main_quest')
        return mainQuests.find((m) => m.id === h.linked_goal_id)?.target_date ?? null;
      return null;
    };
    const pending: PendingQuest[] = daily
      .filter(
        (q) =>
          !isDone(q.instance.status) &&
          q.instance.status !== 'missed' &&
          q.instance.status !== 'skipped' &&
          q.instance.auto_source_snapshot !== 'wake_checkin' &&
          q.instance.measure_snapshot !== 'sleep_hours' &&
          (!lowEnergy || q.instance.core_snapshot),
      )
      .map((q) => {
        const i = q.instance;
        const goal =
          i.min_snapshot !== null && q.progress < i.min_snapshot
            ? i.min_snapshot
            : i.target_snapshot;
        return {
          instanceId: i.id,
          habitId: i.source_id,
          title: i.title_snapshot,
          measure: i.measure_snapshot,
          core: i.core_snapshot,
          remainingMin:
            i.measure_snapshot === 'minutes' && goal !== null
              ? Math.max(0, Math.ceil(goal - q.progress))
              : null,
          goalDeadline: deadline(i.source_id),
        };
      });
    const risks = atRiskToday(day, models, pending, lowEnergy);
    return {
      risks: new Map(risks.map((r) => [r.instanceId, r])),
      next: whatNow(day, hour, models, pending, focus),
    };
  }, [daily, day, lowEnergy, models, focus, habits, milestones, mainQuests, hour]);
}
