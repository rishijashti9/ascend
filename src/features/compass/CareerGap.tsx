import { ExternalLink, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CONFIDENCE_LABEL } from '@/core/adaptive/model';
import type { Dream, MainQuest, PlanProposal } from '@/core/db/types';
import { careerGap, careerPlanItems } from '@/core/compass/gap';
import { careerById, onetUrl, sourceById } from '@/core/compass/pack';
import { useAdaptive } from '@/core/state/adaptive';
import { useAppState } from '@/core/state/app';
import { useGoals } from '@/core/state/goals';
import { useSkills } from '@/core/state/skills';
import { useToday } from '@/core/state/today';
import { weekStartOf } from '@/core/time';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';

const NEW = 'new';

/**
 * Gap analysis for the target career (SPEC 6.7 B): skills still missing in learning order,
 * hours left and readiness at the real pace — and a plan for the Goal Planner (approval first,
 * undoable through Plan history).
 */
export function CareerGap() {
  const targetId = useAppState((s) => s.profile?.compass?.target_career ?? null);
  const weekStartsOn = useAppState((s) => s.settings?.week_start ?? 1);
  const tree = useSkills((s) => s.skills);
  const progress = useSkills((s) => s.progress);
  const capacity = useAdaptive((s) => s.capacity);
  const today = useToday((s) => s.day);
  const allMainQuests = useGoals((s) => s.mainQuests);
  const allDreams = useGoals((s) => s.dreams);
  const mainQuests = allMainQuests.filter((q) => q.status === 'active');
  const dreams = allDreams.filter((d) => d.status === 'active');
  const [goal, setGoal] = useState<string>(NEW);
  const { runFor, busy, error } = useAction();
  const navigate = useNavigate();
  const career = targetId ? careerById(targetId) : undefined;
  if (!career || !today) return null;

  const gap = careerGap(career, tree, (id) => progress.get(id)?.level ?? 0, capacity, today);
  const missing = gap.items.filter((i) => i.hoursLeft > 0);

  const makePlan = async () => {
    let mainQuestId = goal;
    if (goal === NEW) {
      const dreamId =
        dreams[0]?.id ??
        (await runFor<Dream>({ type: 'dream.create', payload: { title: 'My career' } }))?.id;
      if (!dreamId) return;
      const mq = await runFor<MainQuest>({
        type: 'mainQuest.create',
        payload: {
          dream_id: dreamId,
          title: `Become a ${career.title.toLowerCase()}`,
          stat: 'INT',
        },
      });
      if (!mq) return;
      mainQuestId = mq.id;
    }
    const items = careerPlanItems(gap, mainQuestId, 'INT', today, weekStartOf(today, weekStartsOn));
    const proposal = await runFor<PlanProposal>({
      type: 'plan.propose',
      payload: {
        goal_type: 'main_quest',
        goal_id: mainQuestId,
        trigger: `career:${career.id}`,
        summary: `Roadmap to ${career.title}: ${items.filter((i) => i.kind === 'milestone.create').length} skill milestones at your pace, and this week’s first steps.`,
        items,
      },
    });
    if (proposal) navigate(`/goals/${mainQuestId}`);
  };

  return (
    <section aria-label="Your path" className="flex flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{career.title}</h2>
        <p className="text-muted text-sm">
          {gap.done} of {gap.items.length} skills at the level needed.
        </p>
        <p className="text-sm">
          {gap.readiness.why}{' '}
          <span className="text-muted">· {CONFIDENCE_LABEL[gap.readiness.confidence]}</span>
        </p>
      </header>

      {missing.length > 0 && (
        <ol className="border-border bg-surface divide-border flex flex-col divide-y rounded-lg border">
          {missing.map((g) => (
            <li key={g.skill.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{g.skill.name}</span>
                <span className="text-muted text-sm tabular-nums">
                  level {g.have} → {g.need} · ~{g.hoursLeft} h
                </span>
              </div>
              {g.skill.prereqs.length > 0 && (
                <span className="text-muted text-xs">
                  After:{' '}
                  {g.skill.prereqs
                    .map((p) => gap.items.find((i) => i.skill.id === p)?.skill.name ?? p)
                    .join(', ')}
                </span>
              )}
              {g.skill.learn.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-text inline-flex min-h-11 items-center gap-1 text-sm"
                >
                  {l.title} <ExternalLink aria-hidden size={14} />
                </a>
              ))}
            </li>
          ))}
        </ol>
      )}

      {missing.length > 0 && (
        <div className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Plan it under</span>
            <select
              className="border-border bg-surface min-h-11 rounded-md border px-3"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            >
              <option value={NEW}>A new main quest: “Become a {career.title.toLowerCase()}”</option>
              {mainQuests.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={busy} onClick={() => void makePlan()}>
            <Sparkles aria-hidden size={16} /> Turn into a plan
          </Button>
          <p className="text-muted text-xs">
            You’ll see every milestone and quest first — nothing changes until you approve, and it
            can be undone.
          </p>
        </div>
      )}
      <p className="text-muted text-xs">
        Sources:{' '}
        {career.sources.map((id, i) => (
          <span key={id}>
            {i > 0 && ', '}
            <a
              className="text-accent-text"
              href={id === 'onet' && career.onet ? onetUrl(career.onet) : sourceById(id)?.url}
              target="_blank"
              rel="noreferrer"
            >
              {sourceById(id)?.title ?? id}
            </a>
          </span>
        ))}
        .
      </p>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
