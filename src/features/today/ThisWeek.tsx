import { FocusGoalLine } from '@/features/goals/ForecastLine';
import { useAppState } from '@/core/state/app';
import { useGoals } from '@/core/state/goals';
import { currentTimeZone, dayOf, weekStartOf } from '@/core/time';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
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

/** "Planned by the System this week · Undo" for the automatic weekly plan (SPEC 4.5). */
function WeeklyPlanNote({ weekStart }: { weekStart: string }) {
  const history = useGoals((s) => s.history);
  const dayStart = useAppState((s) => s.settings?.day_start_hour ?? 3);
  const { run, busy, error } = useAction();
  const entry = history.find(
    (h) =>
      !h.undone_at &&
      (h.trigger === `weekly:${weekStart}` ||
        // plans saved before the week was part of the trigger
        (h.trigger === 'weekly' &&
          dayOf(Date.parse(h.created_at), currentTimeZone(), dayStart) >= weekStart)),
  );
  if (!entry) return null;
  return (
    <div className="inset flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
      <span>This week’s quests were planned by the System.</span>
      <Button
        variant="ghost"
        className="px-2"
        disabled={busy}
        onClick={() => void run({ type: 'plan.undo', payload: { id: entry.id } })}
      >
        Undo
      </Button>
      {error && (
        <p role="alert" className="text-warning-text w-full text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** Weekly quests and open side quests (SPEC 4.5: shown as "This week", not as daily cards). */
export function ThisWeek() {
  const { week, side, day } = useToday((s) => s);
  const weekStartsOn = useAppState((s) => s.settings?.week_start ?? 1);
  const weekStart = day ? weekStartOf(day, weekStartsOn) : null;
  const note = useNote();
  if (week.length === 0 && side.length === 0) return null;
  const done = week.filter((q) => q.instance.status !== 'pending').length;

  return (
    <section aria-labelledby="week-heading" className="flex flex-col gap-3">
      {week.length > 0 && (
        <>
          <h2 id="week-heading" className="display text-lg">
            This week
            <span className="text-muted ml-2 text-sm font-normal tabular-nums">
              {done} / {week.length} done
            </span>
          </h2>
          <FocusGoalLine />
          {weekStart && <WeeklyPlanNote weekStart={weekStart} />}
          <ul className="flex flex-col gap-3">
            {week.map((q) => (
              <QuestCard key={q.instance.id} quest={q} note={note(q, day)} />
            ))}
          </ul>
        </>
      )}
      {side.length > 0 && (
        <>
          <h2 id={week.length ? undefined : 'week-heading'} className="display text-lg">
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
