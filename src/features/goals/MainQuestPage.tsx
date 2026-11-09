import { ForecastLine } from './ForecastLine';
import { ArrowLeft, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { Milestone } from '@/core/db/types';
import type { MilestoneProgress } from '@/core/engine/goals';
import { useGoals } from '@/core/state/goals';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { StatChip } from '@/ui/stats';
import { ImpactPreview, PendingPlan } from '@/features/planner/PendingPlan';
import { PlanHistoryList } from '@/features/planner/PlanHistory';
import { PlannerSheet } from '@/features/planner/PlannerSheet';
import { formatDay } from './format';
import { FollowUps } from './FollowUps';
import { MainQuestForm, MilestoneForm } from './forms';
import { ProgressLine, StatusActions, StatusChip } from './parts';

/** The just-made plan, inside the planner sheet. */
function SheetPreview({ proposalId, onDone }: { proposalId: string; onDone: () => void }) {
  const proposal = useGoals((s) => s.proposals.find((p) => p.id === proposalId));
  if (!proposal) return <p className="text-muted">Preparing the preview…</p>;
  return <ImpactPreview proposal={proposal} onDone={onDone} />;
}

function describe(m: Milestone, p: MilestoneProgress): string {
  if (m.target_type === 'metric' && m.current_source?.kind === 'body_metric') {
    const unit = m.current_source.metric === 'weight' ? 'kg' : 'cm';
    return `${p.current} ${unit} now · target ${m.target_value} ${unit} (from ${m.current_source.start_value})`;
  }
  if (m.target_type === 'count') return `${p.current} / ${m.target_value}`;
  return `${p.current} of ~${m.estimated_weekly_quests ?? 0} weekly quests done`;
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const p = useGoals((s) => s.milestoneProgress[milestone.id]) ?? {
    progress: 0,
    current: 0,
    reached: false,
  };
  const [editing, setEditing] = useState(false);
  const { run, busy, error } = useAction();
  const id = milestone.id;

  return (
    <li className="panel flex flex-col gap-2 p-4">
      <h3 className="display flex flex-wrap items-center gap-2">
        {milestone.title} <StatusChip status={milestone.status} />
      </h3>
      <ProgressLine value={p.progress} label={`${milestone.title} progress`} />
      <p className="text-muted text-xs">
        {describe(milestone, p)}
        {milestone.target_date && ` · by ${formatDay(milestone.target_date)}`}
      </p>
      {milestone.status === 'active' && <ForecastLine id={milestone.id} />}
      {p.reached && milestone.status !== 'done' && (
        <p className="text-success-text text-sm font-medium">
          Target reached — mark it done when you’re sure.
        </p>
      )}
      {editing ? (
        <MilestoneForm
          initial={milestone}
          busy={busy}
          error={error}
          onCancel={() => setEditing(false)}
          onSave={(changes) =>
            void run({ type: 'milestone.update', payload: { id, changes } }).then(
              (ok) => ok && setEditing(false),
            )
          }
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <StatusActions
            status={milestone.status}
            name={milestone.title}
            run={run}
            busy={busy}
            makeAction={(status) => ({ type: 'milestone.setStatus', payload: { id, status } })}
          />
        </div>
      )}
      {error && !editing && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </li>
  );
}

/** One main quest (SPEC 5): % progress, milestones, deadline and "why this matters to me". */
export function MainQuestPage() {
  const { id = '' } = useParams();
  const quest = useGoals((s) => s.mainQuests.find((q) => q.id === id));
  const dreams = useGoals((s) => s.dreams);
  const allMilestones = useGoals((s) => s.milestones);
  const progress = useGoals((s) => s.mainQuestProgress[id] ?? 0);
  const status = useGoals((s) => s.status);
  const [mode, setMode] = useState<'none' | 'edit' | 'add'>('none');
  const [params, setParams] = useSearchParams();
  // `?plan=new` (just created) or `?plan=deadline` opens the planner straight away (SPEC 6.3).
  const [planning, setPlanning] = useState<string | null>(() => params.get('plan'));
  const closePlanner = () => {
    setPlanning(null);
    if (params.has('plan')) setParams({}, { replace: true });
  };
  const { run, busy, error } = useAction();

  if (!quest) {
    return status === 'ready' ? (
      <div className="flex flex-col gap-3">
        <p>This main quest doesn’t exist any more.</p>
        <Link to="/growth/goals" className="text-accent-text">
          Back to Goals
        </Link>
      </div>
    ) : null;
  }
  const dream = dreams.find((d) => d.id === quest.dream_id);
  const milestones = allMilestones.filter((m) => m.main_quest_id === id);
  const visible = milestones.filter((m) => m.status !== 'archived');
  const archived = milestones.filter((m) => m.status === 'archived');

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link
        to="/growth/goals"
        className="text-accent-text flex min-h-11 items-center gap-1 self-start"
      >
        <ArrowLeft aria-hidden size={18} /> Goals
      </Link>
      <header className="flex flex-col gap-2">
        {dream && <p className="text-muted text-sm">{dream.title}</p>}
        <h1 className="display flex flex-wrap items-center gap-2 text-2xl">
          {quest.title} <StatChip stat={quest.stat} /> <StatusChip status={quest.status} />
        </h1>
        <ProgressLine value={progress} label={`${quest.title} progress`} />
        {quest.target_date && (
          <p className="text-muted text-sm">Deadline: {formatDay(quest.target_date)}</p>
        )}
        {quest.status === 'active' && <ForecastLine id={quest.id} />}
      </header>

      {quest.why && (
        <section aria-label="Why this matters" className="tile tile-violet p-4">
          <h2 className="display mb-1 text-sm">Why this matters to me</h2>
          <p className="italic">“{quest.why}”</p>
        </section>
      )}

      {mode === 'edit' ? (
        <MainQuestForm
          initial={quest}
          busy={busy}
          error={error}
          onCancel={() => setMode('none')}
          onSave={(v) =>
            void run({ type: 'mainQuest.update', payload: { id, changes: v } }).then((ok) => {
              if (!ok) return;
              setMode('none');
              // A new deadline is a meaningful change: re-plan to fit it.
              if (v.target_date !== quest.target_date && quest.status === 'active')
                setPlanning('deadline');
            })
          }
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {quest.status === 'active' && (
            <Button variant="secondary" onClick={() => setPlanning('replan')}>
              <Sparkles aria-hidden size={18} /> Re-plan
            </Button>
          )}
          <Button variant="ghost" onClick={() => setMode('edit')}>
            Edit
          </Button>
          <StatusActions
            status={quest.status}
            name={quest.title}
            run={run}
            busy={busy}
            makeAction={(s) => ({ type: 'mainQuest.setStatus', payload: { id, status: s } })}
          />
        </div>
      )}
      {error && mode === 'none' && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}

      <FollowUps mainQuestId={id} onReplan={() => setPlanning('replan')} />
      <PendingPlan goalId={id} />
      <PlanHistoryList goalId={id} limit={3} />
      {planning && (
        <PlannerSheet mainQuestId={id} trigger={planning} onClose={closePlanner}>
          {(proposalId) => <SheetPreview proposalId={proposalId} onDone={closePlanner} />}
        </PlannerSheet>
      )}

      <section aria-labelledby="milestones-heading" className="flex flex-col gap-3">
        <h2 id="milestones-heading" className="display text-lg">
          Milestones
        </h2>
        {visible.length === 0 && mode !== 'add' && (
          <div className="inset flex flex-col gap-2 p-4">
            <p className="text-sm">
              No plan yet. The Goal Planner can break this goal into milestones and weekly quests
              after a few quick questions — or add milestones yourself.
            </p>
            {quest.status === 'active' && (
              <Button className="self-start" onClick={() => setPlanning('new')}>
                <Sparkles aria-hidden size={18} /> Plan this goal
              </Button>
            )}
          </div>
        )}
        <ul className="flex flex-col gap-3">
          {visible.map((m) => (
            <MilestoneCard key={m.id} milestone={m} />
          ))}
        </ul>
        {mode === 'add' ? (
          <MilestoneForm
            busy={busy}
            error={error}
            saveLabel="Add milestone"
            onCancel={() => setMode('none')}
            onSave={(v) =>
              void run({ type: 'milestone.create', payload: { ...v, main_quest_id: id } }).then(
                (ok) => ok && setMode('none'),
              )
            }
          />
        ) : (
          quest.status !== 'archived' && (
            <Button variant="secondary" className="self-start" onClick={() => setMode('add')}>
              <Plus aria-hidden size={18} /> Milestone
            </Button>
          )
        )}
        {archived.length > 0 && (
          <details>
            <summary className="text-muted min-h-11 cursor-pointer py-2 text-sm">
              {archived.length} archived milestone{archived.length === 1 ? '' : 's'}
            </summary>
            <ul className="flex flex-col gap-3">
              {archived.map((m) => (
                <MilestoneCard key={m.id} milestone={m} />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
