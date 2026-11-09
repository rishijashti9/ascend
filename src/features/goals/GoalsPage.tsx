import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
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

function MainQuestRow({ quest }: { quest: MainQuest }) {
  const progress = useGoals((s) => s.mainQuestProgress[quest.id] ?? 0);
  const milestones = useGoals((s) => s.milestones);
  const own = milestones.filter((m) => m.main_quest_id === quest.id && m.status !== 'archived');
  return (
    <li>
      <Link
        to={`/growth/goals/${quest.id}`}
        className="hover:bg-surface-2 flex min-h-11 flex-col gap-1 rounded-md px-2 py-2"
      >
        <span className="flex items-center gap-2">
          <span className="font-medium">{quest.title}</span>
          <StatChip stat={quest.stat} />
          <StatusChip status={quest.status} />
          <ChevronRight aria-hidden size={16} className="text-muted ml-auto" />
        </span>
        <ProgressLine value={progress} label={`${quest.title} progress`} />
        <span className="text-muted text-xs">
          {own.filter((m) => m.status === 'done').length} of {own.length} milestones
          {quest.target_date && ` · by ${formatDay(quest.target_date)}`}
        </span>
      </Link>
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
    <li className="panel flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {dream.title} <StatusChip status={dream.status} />
          </h2>
          {dream.why && <p className="text-muted mt-1 text-sm italic">“{dream.why}”</p>}
        </div>
        <button
          type="button"
          aria-expanded={mode === 'manage'}
          aria-label={`Manage ${dream.title}`}
          onClick={() => setMode(mode === 'manage' ? 'none' : 'manage')}
          className="text-muted flex size-11 items-center justify-center rounded-md"
        >
          <ChevronDown aria-hidden size={20} className={mode === 'manage' ? 'rotate-180' : ''} />
        </button>
      </div>
      <ProgressLine value={progress} label={`${dream.title} progress`} />
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
        <h1 className="text-xl font-semibold">Goals</h1>
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
        <p className="panel p-4">
          No dream yet. Start with the big picture — where do you want to be in 5–10 years?
        </p>
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
