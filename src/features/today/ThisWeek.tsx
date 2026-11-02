import { useGoals } from '@/core/state/goals';
import { useToday, type TodayQuest } from '@/core/state/today';
import { formatDay } from '@/features/goals/format';
import { QuestCard } from './QuestCard';

/** "For: IELTS 7.5 · Due 3 Nov 2026" — the goal a quest serves, and a side quest's due day. */
function useNote() {
  const milestones = useGoals((s) => s.milestones);
  const mainQuests = useGoals((s) => s.mainQuests);
  return (q: TodayQuest, today: string | null): string | undefined => {
    const parts: string[] = [];
    const quest = q.quest;
    if (quest?.linked_goal_id) {
      const goal =
        quest.linked_goal_type === 'milestone'
          ? milestones.find((m) => m.id === quest.linked_goal_id)
          : mainQuests.find((m) => m.id === quest.linked_goal_id);
      if (goal) parts.push(`For: ${goal.title}`);
    }
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

/** Weekly quests and open side quests (SPEC 4.5: shown as "This week", not as daily cards). */
export function ThisWeek() {
  const { week, side, day } = useToday((s) => s);
  const note = useNote();
  if (week.length === 0 && side.length === 0) return null;
  const done = week.filter((q) => q.instance.status !== 'pending').length;

  return (
    <section aria-labelledby="week-heading" className="flex flex-col gap-3">
      {week.length > 0 && (
        <>
          <h2 id="week-heading" className="text-lg font-semibold">
            This week
            <span className="text-muted ml-2 text-sm font-normal tabular-nums">
              {done} / {week.length} done
            </span>
          </h2>
          <ul className="flex flex-col gap-3">
            {week.map((q) => (
              <QuestCard key={q.instance.id} quest={q} note={note(q, day)} />
            ))}
          </ul>
        </>
      )}
      {side.length > 0 && (
        <>
          <h2 id={week.length ? undefined : 'week-heading'} className="text-lg font-semibold">
            Side quests
          </h2>
          <ul className="flex flex-col gap-3">
            {side.map((q) => (
              <QuestCard key={q.instance.id} quest={q} note={note(q, day)} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
