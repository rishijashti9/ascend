import { ChevronDown, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Dream, MainQuest } from '@/core/db/types';
import { useGoals } from '@/core/state/goals';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { StatChip } from '@/ui/stats';
import { PendingPlan } from '@/features/planner/PendingPlan';
import { PlanHistoryList } from '@/features/planner/PlanHistory';
import { DreamForm, MainQuestForm } from './forms';
import { formatDay } from './format';
import { ProgressLine, StatusActions, StatusChip } from './parts';
import { planState } from './planState';
import { EmptyState } from '@/ui/EmptyState';

/**
 * One main quest in the Vision (UX-4, docs/product/AUDIT-AND-PROPOSAL.md P5/P13): one progress
 * number, and where it stands — no plan yet (with Plan it), a plan waiting for approval, the next
 * milestone, or done — so the step from "I want this" to "what I do this week" happens here.
 */
function MainQuestRow({ quest }: { quest: MainQuest }) {
  const progress = useGoals((s) => s.mainQuestProgress[quest.id] ?? 0);
  const milestones = useGoals((s) => s.milestones);
  const proposals = useGoals((s) => s.proposals);
  const own = milestones.filter((m) => m.main_quest_id === quest.id && m.status !== 'archived');
  const state = planState(quest, milestones, proposals);
  const doneCount = own.filter((m) => m.status === 'done').length;
  const line =
    state.kind === 'unplanned'
      ? 'No plan yet'
      : state.kind === 'waiting'
        ? 'A plan is waiting for your approval'
        : state.kind === 'next'
          ? `Next: ${state.milestone.title}`
          : own.length > 0
            ? `${doneCount} of ${own.length} milestones done`
            : null;
  return (
    <li className="inset flex flex-col gap-2 px-3 py-3">
      <Link
        to={`/growth/goals/${quest.id}`}
        className="flex min-h-11 flex-col gap-1.5 transition-transform duration-(--dur) active:scale-[0.99]"
      >
        <span className="flex items-center gap-2">
          <span className="display text-base">{quest.title}</span>
          <StatChip stat={quest.stat} />
          <StatusChip status={quest.status} />
          <span className="display ml-auto text-lg tabular-nums">
            {Math.round(progress * 100)}%
          </span>
          <ChevronRight aria-hidden size={16} className="text-muted" />
        </span>
        <ProgressLine value={progress} label={`${quest.title} progress`} showValue={false} />
        <span className="text-muted text-xs">
          {[line, quest.target_date ? `by ${formatDay(quest.target_date)}` : null]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </Link>
      {state.kind === 'unplanned' && (
        <Link
          to={`/growth/goals/${quest.id}?plan=new`}
          className="bg-accent-fill text-on-accent inline-flex min-h-11 items-center gap-2 self-start rounded-full px-4 text-sm font-semibold"
        >
          <Sparkles aria-hidden size={16} /> Plan it
        </Link>
      )}
      {state.kind === 'waiting' && (
        <Link
          to={`/growth/goals/${quest.id}`}
          className="text-accent-text inline-flex min-h-11 items-center self-start text-sm font-semibold"
        >
          Review the plan
        </Link>
      )}
    </li>
  );
}

function DreamCard({ dream }: { dream: Dream }) {
  const progress = useGoals((s) => s.dreamProgress[dream.id] ?? 0);
  const allQuests = useGoals((s) => s.mainQuests);
  const quests = allQuests.filter((q) => q.dream_id === dream.id);
  const [mode, setMode] = useState<'none' | 'manage' | 'edit' | 'add'>('none');
  const { run, runFor, busy, error } = useAction();
  const navigate = useNavigate();

  const visible = quests.filter((q) => q.status !== 'archived');
  const archived = quests.filter((q) => q.status === 'archived');

  return (
    <li className="panel flex flex-col gap-3 p-3">
      <div className="tile tile-lime flex items-start gap-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-on-tile-muted text-xs font-bold tracking-widest uppercase">Dream</p>
          <h2 className="display mt-1 flex flex-wrap items-center gap-2 text-xl">
            {dream.title} <StatusChip status={dream.status} />
          </h2>
          {dream.why && <p className="text-on-tile-muted mt-1 text-sm italic">“{dream.why}”</p>}
          <p className="text-on-tile-muted mt-2 text-sm">
            {visible.length} main quest{visible.length === 1 ? '' : 's'} ·{' '}
            <span className="display text-on-tile-lime text-lg">{Math.round(progress * 100)}%</span>{' '}
            overall
          </p>
        </div>
        <button
          type="button"
          aria-expanded={mode === 'manage'}
          aria-label={`Manage ${dream.title}`}
          onClick={() => setMode(mode === 'manage' ? 'none' : 'manage')}
          className="flex size-11 items-center justify-center rounded-full"
        >
          <ChevronDown aria-hidden size={20} className={mode === 'manage' ? 'rotate-180' : ''} />
        </button>
      </div>
      <ProgressLine value={progress} label={`${dream.title} progress`} showValue={false} />
      <PendingPlan goalId={dream.id} />

      {mode === 'manage' && (
        <div className="border-border flex flex-col gap-2 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setMode('edit')}>
              Edit
            </Button>
            <StatusActions
              status={dream.status}
              name={dream.title}
              run={run}
              busy={busy}
              makeAction={(status) => ({
                type: 'dream.setStatus',
                payload: { id: dream.id, status },
              })}
            />
          </div>
          {error && (
            <p role="alert" className="text-warning-text text-sm">
              {error}
            </p>
          )}
        </div>
      )}
      {mode === 'edit' && (
        <DreamForm
          initial={{ title: dream.title, why: dream.why }}
          busy={busy}
          error={error}
          onCancel={() => setMode('none')}
          onSave={(changes) =>
            void run({ type: 'dream.update', payload: { id: dream.id, changes } }).then(
              (ok) => ok && setMode('none'),
            )
          }
        />
      )}

      <ul className="flex flex-col gap-1">
        {visible.map((q) => (
          <MainQuestRow key={q.id} quest={q} />
        ))}
      </ul>
      {visible.length === 0 && mode !== 'add' && (
        <p className="text-muted text-sm">
          No main quests yet — add the first big goal toward this dream.
        </p>
      )}
      {mode === 'add' ? (
        <MainQuestForm
          busy={busy}
          error={error}
          saveLabel="Add main quest"
          onCancel={() => setMode('none')}
          onSave={(v) =>
            void runFor<MainQuest>({
              type: 'mainQuest.create',
              payload: { ...v, dream_id: dream.id },
            }).then((created) => {
              if (!created) return;
              setMode('none');
              // A new main quest is planned right away (SPEC 6.3).
              void navigate(`/growth/goals/${created.id}?plan=new`);
            })
          }
        />
      ) : (
        dream.status !== 'archived' && (
          <Button variant="secondary" className="self-start" onClick={() => setMode('add')}>
            <Plus aria-hidden size={18} />
            Main quest
          </Button>
        )
      )}
      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted min-h-11 cursor-pointer py-2">
            {archived.length} archived main quest{archived.length === 1 ? '' : 's'}
          </summary>
          <ul className="flex flex-col gap-1">
            {archived.map((q) => (
              <MainQuestRow key={q.id} quest={q} />
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/** Vision & Goals (SPEC 5, 7.4): dreams with the progress beneath them. */
export function GoalsPage() {
  const dreams = useGoals((s) => s.dreams);
  const [adding, setAdding] = useState(false);
  const { run, busy, error } = useAction();
  const open = dreams.filter((d) => d.status !== 'archived');
  const archived = dreams.filter((d) => d.status === 'archived');

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Growth's Goals tab already names this screen (Phase 12). */}
        <h1 className="sr-only">Goals</h1>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden size={18} />
            New dream
          </Button>
        )}
      </div>
      {adding && (
        <DreamForm
          busy={busy}
          error={error}
          saveLabel="Add dream"
          onCancel={() => setAdding(false)}
          onSave={(v) =>
            void run({ type: 'dream.create', payload: v }).then((ok) => ok && setAdding(false))
          }
        />
      )}
      {open.length === 0 && !adding && (
        <EmptyState>
          No dream yet. Start with the big picture — where do you want to be in 5–10 years?
        </EmptyState>
      )}
      <ul className="flex flex-col gap-4">
        {open.map((d) => (
          <DreamCard key={d.id} dream={d} />
        ))}
      </ul>
      <PlanHistoryList limit={20} />
      {archived.length > 0 && (
        <details>
          <summary className="text-muted min-h-11 cursor-pointer py-2">
            Archived dreams ({archived.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-4">
            {archived.map((d) => (
              <DreamCard key={d.id} dream={d} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
