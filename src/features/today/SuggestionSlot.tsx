import type { ReactNode } from 'react';
import { DifficultyCard } from './DifficultyCard';
import { GoalNudges } from './GoalNudges';
import { ReminderTimeCard } from './ReminderTimeCard';
import { BurnoutCard } from './BurnoutCard';
import {
  useBurnoutCard,
  useDifficultyVisible,
  useGoalNudgeRows,
  useReminderCard,
} from './suggestionHooks';

/**
 * Today shows at most ONE suggestion card at a time (SPEC 6.7 rules). Candidates in priority
 * order; the first that has something to say wins, the rest wait their turn. Later Phase 8
 * cards (burnout warning, adaptive difficulty, best times, weekly focus) join this list.
 */
export function SuggestionSlot({
  extra = [],
}: {
  extra?: { visible: boolean; node: ReactNode }[];
}) {
  const burnout = useBurnoutCard() !== null;
  const difficulty = useDifficultyVisible();
  const goals = useGoalNudgeRows().length > 0;
  const reminder = useReminderCard() !== null;
  const candidates = [
    ...extra.filter((c) => c.visible).slice(0, 1),
    { visible: burnout, node: <BurnoutCard /> },
    { visible: difficulty, node: <DifficultyCard /> },
    { visible: goals, node: <GoalNudges /> },
    { visible: reminder, node: <ReminderTimeCard /> },
  ];
  return candidates.find((c) => c.visible)?.node ?? null;
}
