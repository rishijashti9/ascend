import { ChevronDown, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Quest } from '@/core/db/types';
import { useAppState } from '@/core/state/app';
import { useGoals } from '@/core/state/goals';
import { useQuests } from '@/core/state/quests';
import { useToday } from '@/core/state/today';
import { weekStartOf } from '@/core/time';
import { formatDay } from '@/features/goals/format';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { StatChip } from '@/ui/stats';
import { QuestDefForm } from './QuestDefForm';
import { NEW_QUEST, valuesOf } from './questDefValues';

const STATUS: Record<Quest['status'], string> = {
  active: 'Open',
  done: 'Done',
  not_done: 'Not done',
  archived: 'Archived',
};

function QuestDefRow({ quest }: { quest: Quest }) {
  const [open, setOpen] = useState(false);
  const { run, busy, error } = useAction();
  const milestones = useGoals((s) => s.milestones);
  const mainQuests = useGoals((s) => s.mainQuests);
  const goal =
    quest.linked_goal_type === 'milestone'
      ? milestones.find((m) => m.id === quest.linked_goal_id)
      : mainQuests.find((m) => m.id === quest.linked_goal_id);
  const archived = quest.status === 'archived';
  const target =
    quest.measure === 'check'
      ? ''
      : `${quest.target_value} ${quest.measure === 'minutes' ? 'min' : ''}`;

  return (
    <li className="panel p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-1 pl-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 className="display">{quest.title}</h3>
            <StatChip stat={quest.stat} />
            <span
              className={`text-xs ${quest.status === 'done' ? 'text-success-text' : 'text-muted'}`}
            >
              {STATUS[quest.status]}
            </span>
          </div>
          <p className="text-muted text-xs">
            {[
              target.trim(),
              goal && `For: ${goal.title}`,
              quest.due_day && `Due ${formatDay(quest.due_day)}`,
              quest.planned_by !== 'me' && 'Planned by System',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Edit ${quest.title}`}
          onClick={() => setOpen(!open)}
          className="text-muted hover:text-text hover:bg-surface-2 flex size-11 items-center justify-center rounded-full"
        >
          <ChevronDown aria-hidden size={20} className={open ? 'rotate-180' : ''} />
        </button>
      </div>
      {open && (
        <div className="border-border mt-3 flex flex-col gap-3 border-t pt-3">
          {!archived && quest.status !== 'not_done' && (
            <QuestDefForm
              kind={quest.type === 'weekly' ? 'weekly' : 'side'}
              initial={valuesOf(quest)}
              busy={busy}
              error={error}
              saveLabel="Save"
              onCancel={() => setOpen(false)}
              onSave={(changes) =>
                void run({ type: 'quest.update', payload: { id: quest.id, changes } }).then(
                  (ok) => ok && setOpen(false),
                )
              }
            />
          )}
          <Button
            variant="ghost"
            className="self-start"
            disabled={busy}
            onClick={() =>
              void run({ type: 'quest.archive', payload: { id: quest.id, archived: !archived } })
            }
          >
            {archived ? 'Restore' : 'Archive'}
          </Button>
        </div>
      )}
    </li>
  );
}

function List({ quests, empty }: { quests: Quest[]; empty?: string }) {
  if (quests.length === 0) return empty ? <p className="text-muted text-sm">{empty}</p> : null;
  return (
    <ul className="flex flex-col gap-2">
      {quests.map((q) => (
        <QuestDefRow key={q.id} quest={q} />
      ))}
    </ul>
  );
}

function Collapsed({ title, quests }: { title: string; quests: Quest[] }) {
  if (quests.length === 0) return null;
  return (
    <details>
      <summary className="text-muted min-h-11 cursor-pointer py-2 text-sm">
        {title} ({quests.length})
      </summary>
      <List quests={quests} />
    </details>
  );
}

function NewQuestButton({ kind }: { kind: 'weekly' | 'side' }) {
  const [adding, setAdding] = useState(false);
  const { run, busy, error } = useAction();
  if (!adding) {
    return (
      <Button className="self-end" onClick={() => setAdding(true)}>
        <Plus aria-hidden size={18} /> New quest
      </Button>
    );
  }
  return (
    <QuestDefForm
      kind={kind}
      initial={NEW_QUEST}
      busy={busy}
      error={error}
      saveLabel="Add quest"
      onCancel={() => setAdding(false)}
      onSave={(v) =>
        void run({ type: 'quest.create', payload: { ...v, type: kind } }).then(
          (ok) => ok && setAdding(false),
        )
      }
    />
  );
}

/** Weekly quests: 3–5 concrete steps toward main quests this week (SPEC 4.5). */
export function WeeklyTab() {
  const weekly = useQuests((s) => s.weekly);
  const day = useToday((s) => s.day);
  const weekStartsOn = useAppState((s) => s.settings?.week_start ?? 1);
  const thisWeek = day ? weekStartOf(day, weekStartsOn) : null;
  const current = weekly.filter((q) => q.week_start === thisWeek && q.status !== 'archived');
  const past = weekly.filter((q) => q.week_start !== thisWeek && q.status !== 'archived');
  return (
    <div className="flex flex-col gap-4">
      <NewQuestButton kind="weekly" />
      <h2 className="display text-lg">
        This week
        {thisWeek && (
          <span className="text-muted ml-2 text-sm font-normal">from {formatDay(thisWeek)}</span>
        )}
      </h2>
      <List
        quests={current}
        empty="No weekly quests this week. Add 3–5 concrete steps toward your goals."
      />
      <Collapsed title="Earlier weeks" quests={past} />
      <Collapsed title="Archived" quests={weekly.filter((q) => q.status === 'archived')} />
    </div>
  );
}

/** Side quests: one-off tasks, open until done (SPEC 4.5). */
export function SideTab() {
  const side = useQuests((s) => s.side);
  return (
    <div className="flex flex-col gap-4">
      <NewQuestButton kind="side" />
      <List quests={side.filter((q) => q.status === 'active')} empty="No open side quests." />
      <Collapsed title="Done" quests={side.filter((q) => q.status === 'done')} />
      <Collapsed title="Archived" quests={side.filter((q) => q.status === 'archived')} />
    </div>
  );
}
