import { mayShow } from '@/core/adaptive/patterns';
import { isEnabled } from '@/config/features';
import { useAdaptive } from '@/core/state/adaptive';
import { useGoals } from '@/core/state/goals';
import { useSuggestion } from '@/core/state/suggestion';
import { useToday } from '@/core/state/today';
import { useNudges } from '@/features/goals/useNudges';

/** Visibility of Today's suggestion cards, for the one-card SuggestionSlot (SPEC 6.7). */

/** Whether DifficultyCard has something to show (an applied change's Undo, or a welcome suggestion). */
export function useDifficultyVisible(): boolean {
  const suggestion = useSuggestion((s) => s.suggestion);
  const day = useToday((s) => s.day);
  const history = useGoals((s) => s.history);
  const input = useAdaptive((s) => s.input);
  const applied = history.some(
    (h) => !h.undone_at && day && h.trigger.startsWith('difficulty:') && h.trigger.endsWith(day),
  );
  if (applied) return true;
  if (!suggestion) return false;
  // Kinds Rishi keeps turning down come back less often (never less than weekly).
  return !input || mayShow(input, `difficulty_${suggestion.kind}`);
}

/** The goals listed by GoalNudges (empty when there is nothing to show). */
export function useGoalNudgeRows(): { id: string; title: string; note: string; to: string }[] {
  const nudges = useNudges();
  const mainQuests = useGoals((s) => s.mainQuests);
  const milestones = useGoals((s) => s.milestones);
  const proposals = useGoals((s) => s.proposals);
  if (!isEnabled('goals')) return [];

  const unplanned = mainQuests.filter(
    (q) =>
      q.status === 'active' &&
      !milestones.some((m) => m.main_quest_id === q.id && m.status !== 'archived') &&
      !proposals.some((p) => p.goal_id === q.id),
  );
  const rows = [
    ...unplanned.map((q) => ({
      id: q.id,
      title: q.title,
      note: 'needs a plan',
      to: `/goals/${q.id}?plan=new`,
    })),
    ...[...new Set(nudges.map((n) => n.mainQuestId))].map((id) => ({
      id,
      title: mainQuests.find((x) => x.id === id)?.title ?? '',
      note: nudges.some((n) => n.mainQuestId === id && n.kind === 'risk')
        ? 'behind schedule'
        : 'monthly check-in',
      to: `/goals/${id}`,
    })),
  ]
    .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
    .slice(0, 3);
  return rows;
}
