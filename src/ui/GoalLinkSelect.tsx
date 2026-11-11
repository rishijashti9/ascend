import type { GoalType } from '@/core/db/types';
import { useGoals } from '@/core/state/goals';
import { Select } from '@/ui/Field';

/** What a quest can be linked to from its form: a main quest or one of its milestones. */
export interface GoalLink {
  linked_goal_type: GoalType | null;
  linked_goal_id: string | null;
}

/**
 * The goal choices for a quest form: not linked, the active/upcoming milestones (with their main
 * quest), then the active main quests. ONE list for weekly, side and daily quests (linking plan L1,
 * docs/product/LINKING-PLAN.md) — the daily quest editor used to have no way to link at all.
 */
function useGoalOptions(): { value: string; label: string }[] {
  const milestones = useGoals((s) => s.milestones);
  const mainQuests = useGoals((s) => s.mainQuests);
  const live = mainQuests.filter((q) => q.status === 'active');
  const mqTitle = (id: string) => mainQuests.find((q) => q.id === id)?.title ?? '';
  return [
    { value: '', label: 'Not linked (counts toward its stat only)' },
    ...milestones
      .filter((m) => m.status === 'active' || m.status === 'upcoming')
      .map((m) => ({
        value: `milestone:${m.id}`,
        label: `${m.title} — ${mqTitle(m.main_quest_id)}`,
      })),
    ...live.map((q) => ({ value: `main_quest:${q.id}`, label: `${q.title} (main quest)` })),
  ];
}

/** "Toward goal": pick a main quest or milestone, or none. Both fields change together. */
export function GoalLinkSelect({
  value,
  onChange,
}: {
  value: GoalLink;
  onChange: (link: GoalLink) => void;
}) {
  const options = useGoalOptions();
  const current =
    value.linked_goal_type && value.linked_goal_id
      ? `${value.linked_goal_type}:${value.linked_goal_id}`
      : '';
  return (
    <Select
      label="Toward goal"
      value={current}
      options={options}
      onChange={(e) => {
        const [type, id] = e.target.value.split(':') as ['main_quest' | 'milestone', string];
        onChange(
          e.target.value
            ? { linked_goal_type: type, linked_goal_id: id }
            : { linked_goal_type: null, linked_goal_id: null },
        );
      }}
    />
  );
}
