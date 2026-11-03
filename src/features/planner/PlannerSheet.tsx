import { useDialog } from '@/ui/hooks/useDialog';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db } from '@/core/db/db';
import type { MainQuest } from '@/core/db/types';
import {
  analyze,
  defaultAnswers,
  interviewFor,
  loadPlannerState,
  matchTemplate,
  planMainQuest,
  type Answers,
  type PlannerState,
  type PlanTemplate,
} from '@/core/planner';
import { PLAN_TEMPLATES } from '@/data/planTemplates';
import { Button } from '@/ui/Button';
import { Select } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';
import { QuestionField } from './QuestionField';

type Step = 'analyze' | 'interview' | 'ready';

/**
 * The Goal Planner sheet (SPEC 6.3): analyze → short interview → plan. The plan is saved as a
 * proposal; nothing changes until it's approved.
 */
export function PlannerSheet({
  mainQuestId,
  trigger = 'replan',
  onClose,
  children,
}: {
  mainQuestId: string;
  trigger?: string;
  onClose: () => void;
  /** Rendered in the last step (the impact preview for the saved proposal). */
  children?: (proposalId: string) => React.ReactNode;
}) {
  const [state, setState] = useState<PlannerState | null>(null);
  const [template, setTemplate] = useState<PlanTemplate | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState<Step>('analyze');
  const [proposalId, setProposalId] = useState<string | null>(null);
  const { run, busy, error } = useAction();

  const goal: MainQuest | undefined = state?.mainQuests.find((q) => q.id === mainQuestId);

  useEffect(() => {
    void loadPlannerState(db).then((s) => {
      setState(s);
      const g = s.mainQuests.find((q) => q.id === mainQuestId);
      if (!g) return;
      const t = matchTemplate(g.title, g.planner_context);
      setTemplate(t);
      setAnswers(defaultAnswers(interviewFor(t, g)));
    });
  }, [mainQuestId]);

  const closeRef = useDialog(onClose);

  const questions = goal && template ? interviewFor(template, goal) : [];
  const analysis = state && goal ? analyze(state, goal) : null;

  async function makePlan() {
    if (!state || !goal || !template) return;
    const all = { ...answers, template: template.id };
    const plan = planMainQuest(state, goal, all, template);
    const result = await run({
      type: 'plan.propose',
      payload: {
        goal_type: 'main_quest',
        goal_id: goal.id,
        trigger,
        summary: plan.summary,
        items: plan.items,
        answers: all,
      },
    });
    if (result) {
      const latest = (await db.plan_proposals.where('goal_id').equals(goal.id).toArray())
        .filter((p) => p.status === 'pending')
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      setProposalId(latest?.id ?? null);
      setStep('ready');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="planner-title"
      className="bg-bg fixed inset-0 z-40 overflow-y-auto"
    >
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-accent-text flex items-center gap-1 text-xs font-semibold tracking-wide uppercase">
              <Sparkles aria-hidden size={14} /> Goal Planner
            </p>
            <h2 id="planner-title" className="text-xl font-semibold">
              {goal?.title ?? 'Planning…'}
            </h2>
          </div>
          <button
            type="button"
            ref={closeRef}
            aria-label="Close planner"
            onClick={onClose}
            className="text-muted flex size-11 items-center justify-center rounded-md"
          >
            <X aria-hidden size={20} />
          </button>
        </header>

        {state && !goal && <p>This goal no longer exists.</p>}

        {step === 'analyze' && goal && analysis && template && (
          <section aria-label="Analysis" className="flex flex-col gap-4">
            <p className="text-muted">
              Your daily quests take about {Math.round(analysis.dailyLoadMin / 6) / 10} h a day
              {analysis.completionRate !== null &&
                `, and you've done ${Math.round(analysis.completionRate * 100)}% of them lately`}
              . You have {analysis.activeMainQuests} active main quest
              {analysis.activeMainQuests === 1 ? '' : 's'}.
            </p>
            {analysis.conflicts.length > 0 ? (
              <ul className="bg-surface-2 flex flex-col gap-1 rounded-lg p-4 text-sm">
                {analysis.conflicts.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-success-text text-sm">
                No conflicts — there's room for this goal.
              </p>
            )}
            <Select
              label="Plan type"
              value={template.id}
              options={PLAN_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
              onChange={(e) => {
                const t = PLAN_TEMPLATES.find((x) => x.id === e.target.value) ?? template;
                setTemplate(t);
                setAnswers(defaultAnswers(interviewFor(t, goal)));
              }}
            />
            <Button
              onClick={() => (questions.length ? setStep('interview') : void makePlan())}
              disabled={busy}
            >
              {questions.length ? 'Next' : 'Make my plan'}
            </Button>
          </section>
        )}

        {step === 'interview' && goal && (
          <section aria-label="Questions" className="flex flex-col gap-5">
            <p className="text-muted text-sm">
              A few quick answers — they're remembered, so you won't be asked again.
            </p>
            {questions.map((q) => (
              <QuestionField
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
              />
            ))}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep('analyze')} disabled={busy}>
                Back
              </Button>
              <Button className="flex-1" onClick={() => void makePlan()} disabled={busy}>
                {busy ? 'Planning…' : 'Make my plan'}
              </Button>
            </div>
          </section>
        )}

        {step === 'ready' &&
          proposalId &&
          (children ? children(proposalId) : <Button onClick={onClose}>Done</Button>)}

        {error && (
          <p role="alert" className="text-warning-text text-sm">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
