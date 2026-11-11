import { useGoals } from '@/core/state/goals';
import { useHabits } from '@/core/state/habits';
import { useSkills } from '@/core/state/skills';
import type { TodayQuest } from '@/core/state/today';
import { formatDay } from '@/features/goals/format';

/**
 * The "why does this matter?" line on a quest card (UX-3, docs/product/AUDIT-AND-PROPOSAL.md P4):
 * the main quest or milestone it serves and the skills it builds — for daily quests (through
 * their habit) as well as weekly and side quests — plus a weekly quest's due day.
 * Returns undefined when the quest isn't linked to anything (nothing is invented).
 */
export function useLinkNote(): (q: TodayQuest, today: string | null) => string | undefined {
  const milestones = useGoals((s) => s.milestones);
  const mainQuests = useGoals((s) => s.mainQuests);
  const habits = useHabits((s) => s.habits);
  const skills = useSkills((s) => s.skills);

  return (q, today) => {
    const parts: string[] = [];
    const source =
      q.quest ??
      (q.instance.source_type === 'habit'
        ? (habits.find((h) => h.id === q.instance.source_id) ?? null)
        : null);
    if (source?.linked_goal_id) {
      const goal =
        source.linked_goal_type === 'milestone'
          ? milestones.find((m) => m.id === source.linked_goal_id)
          : mainQuests.find((m) => m.id === source.linked_goal_id);
      if (goal && !goal.deleted_at) parts.push(`For: ${goal.title}`);
    }
    const skillIds = q.instance.skill_ids_snapshot ?? source?.skill_ids ?? [];
    const names = skillIds
      .map((id) => skills.find((s) => s.id === id && !s.deleted_at)?.name)
      .filter((n): n is string => !!n);
    if (names.length > 0)
      parts.push(`Builds: ${names.slice(0, 2).join(', ')}${names.length > 2 ? '…' : ''}`);
    const quest = q.quest;
    if (quest?.due_day && q.instance.status === 'pending') {
      parts.push(
        today && quest.due_day < today
          ? `Was due ${formatDay(quest.due_day)}`
          : `Due ${formatDay(quest.due_day)}`,
      );
    }
    return parts.length ? parts.join(' · ') : undefined;
  };
}
