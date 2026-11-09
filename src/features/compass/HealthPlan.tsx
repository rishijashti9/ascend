import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { HealthCheckIn } from '@/core/compass/health';
import { healthGap } from '@/core/compass/health';
import { healthPlanItems } from '@/core/compass/healthPlan';
import { countryFromTimeZone } from '@/core/compass/safety';
import type { Dream, MainQuest, PlanProposal } from '@/core/db/types';
import { useAdaptive } from '@/core/state/adaptive';
import { useAppState } from '@/core/state/app';
import { useGoals } from '@/core/state/goals';
import { useHabits } from '@/core/state/habits';
import { currentTimeZone, weekStartOf } from '@/core/time';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';

const NEW = 'new';

/**
 * Health roadmap → Goal Planner (SPEC 6.7 B): gradual training, a sleep routine and simple
 * nutrition habits from the check-in goals. Shown in full before anything changes; undoable.
 */
export function HealthPlan() {
  const checkIn = useAppState((s) => s.profile?.compass?.health) as HealthCheckIn | undefined;
  const weekStartsOn = useAppState((s) => s.settings?.week_start ?? 1);
  const input = useAdaptive((s) => s.input);
  const habits = useHabits((s) => s.habits);
  const allMainQuests = useGoals((s) => s.mainQuests);
  const allDreams = useGoals((s) => s.dreams);
  const [goal, setGoal] = useState(NEW);
  const { runFor, busy, error } = useAction();
  const navigate = useNavigate();
  if (!checkIn || !input || checkIn.goals.length === 0) return null;
  const mainQuests = allMainQuests.filter((q) => q.status === 'active');
  const gap = healthGap(input, checkIn, countryFromTimeZone(currentTimeZone()));

  const make = async () => {
    let mainQuestId = goal;
    if (goal === NEW) {
      const dreamId =
        allDreams.find((d) => d.status === 'active')?.id ??
        (
          await runFor<Dream>({
            type: 'dream.create',
            payload: { title: 'A strong, healthy life' },
          })
        )?.id;
      if (!dreamId) return;
      const mq = await runFor<MainQuest>({
        type: 'mainQuest.create',
        payload: { dream_id: dreamId, title: 'A healthier body', stat: 'STR' },
      });
      if (!mq) return;
      mainQuestId = mq.id;
    }
    const items = healthPlanItems({
      checkIn,
      gap,
      habits,
      mainQuestId,
      today: input.today,
      weekStart: weekStartOf(input.today, weekStartsOn),
      weightKg: input.weight.at(-1)?.value ?? null,
    });
    const proposal = await runFor<PlanProposal>({
      type: 'plan.propose',
      payload: {
        goal_type: 'main_quest',
        goal_id: mainQuestId,
        trigger: 'health_plan',
        summary:
          'Health roadmap: gradual training, a steady sleep routine and simple food habits — at a safe pace.',
        items,
      },
    });
    if (proposal) navigate(`/goals/${mainQuestId}`);
  };

  return (
    <div className="panel flex flex-col gap-2 p-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Plan it under</span>
        <select
          className="control min-h-11 px-3"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        >
          <option value={NEW}>A new main quest: “A healthier body”</option>
          {mainQuests.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title}
            </option>
          ))}
        </select>
      </label>
      <Button disabled={busy} onClick={() => void make()}>
        <Sparkles aria-hidden size={16} /> Turn into a health plan
      </Button>
      <p className="text-muted text-xs">
        Every step is shown first; nothing changes until you approve, and it can be undone.
      </p>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
