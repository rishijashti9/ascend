import type { Difficulty, Quest, Stat } from '@/core/db/types';

export interface QuestDefValues {
  title: string;
  stat: Stat;
  difficulty: Difficulty;
  measure: 'check' | 'count' | 'minutes';
  target_value: number | null;
  linked_goal_type: 'main_quest' | 'milestone' | null;
  linked_goal_id: string | null;
  due_day: string | null;
  skill_ids: string[];
}

export const NEW_QUEST: QuestDefValues = {
  title: '',
  stat: 'INT',
  difficulty: 'normal',
  measure: 'check',
  target_value: null,
  linked_goal_type: null,
  linked_goal_id: null,
  due_day: null,
  skill_ids: [],
};

/** Form values from a stored quest. */
export function valuesOf(q: Quest): QuestDefValues {
  return {
    title: q.title,
    stat: q.stat,
    difficulty: q.difficulty,
    measure: q.measure === 'count' || q.measure === 'minutes' ? q.measure : 'check',
    target_value: q.target_value,
    linked_goal_type:
      q.linked_goal_type === 'milestone' || q.linked_goal_type === 'main_quest'
        ? q.linked_goal_type
        : null,
    linked_goal_id: q.linked_goal_id,
    due_day: q.due_day,
    skill_ids: [...q.skill_ids],
  };
}
