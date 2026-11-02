import { useMemo } from 'react';
import { goalNudges, type Nudge } from '@/core/planner/nudges';
import { useAppState } from '@/core/state/app';
import { useGoals } from '@/core/state/goals';
import { useToday } from '@/core/state/today';
import { currentTimeZone, dayOf } from '@/core/time';

/** Goal follow-ups for today (deadline risk, 30-day check-in). */
export function useNudges(): Nudge[] {
  const mainQuests = useGoals((s) => s.mainQuests);
  const milestones = useGoals((s) => s.milestones);
  const milestoneProgress = useGoals((s) => s.milestoneProgress);
  const today = useToday((s) => s.day);
  const dayStart = useAppState((s) => s.settings?.day_start_hour ?? 3);
  return useMemo(
    () =>
      today
        ? goalNudges({
            today,
            mainQuests,
            milestones,
            milestoneProgress,
            dayOfIso: (iso) => dayOf(Date.parse(iso), currentTimeZone(), dayStart),
          })
        : [],
    [today, mainQuests, milestones, milestoneProgress, dayStart],
  );
}
