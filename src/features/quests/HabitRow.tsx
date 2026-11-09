import { ArrowDown, ArrowUp, ChevronDown, Flame, Star } from 'lucide-react';
import { useState } from 'react';
import { GAME } from '@/config/game';
import type { Habit } from '@/core/db/types';
import type { HabitStreak } from '@/core/engine/streaks';
import { Button } from '@/ui/Button';
import { Confirm } from '@/ui/Confirm';
import {
  editProblems,
  habitSummary,
  scheduleLabel,
  type EditableHabit,
} from '@/ui/habit/habitEdit';
import { changesOf, editableOf } from './habitDiff';
import { HabitEditor } from '@/ui/habit/HabitEditor';
import { useAction } from '@/ui/hooks/useAction';
import { StatChip } from '@/ui/stats';

interface RowProps {
  habit: Habit;
  streak: HabitStreak | undefined;
  coreFull: boolean;
  onMove?: (direction: -1 | 1) => void;
  first?: boolean;
  last?: boolean;
}

/** One habit on the Quests screen: summary, core star, and an expandable editor + actions. */
export function HabitRow({ habit, streak, coreFull, onMove, first, last }: RowProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EditableHabit>(() => editableOf(habit));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { run, busy, error } = useAction();
  const active = habit.status === 'active';
  const id = habit.id;

  const toggleOpen = () => {
    if (!open) setDraft(editableOf(habit));
    setOpen(!open);
    setConfirmDelete(false);
  };
  const save = async () => {
    const changes = changesOf(habit, draft);
    if (
      Object.keys(changes).length === 0 ||
      (await run({ type: 'habit.update', payload: { id, changes } }))
    )
      setOpen(false);
  };
  const problems = editProblems(draft);

  return (
    <li className={`panel p-3 ${active ? '' : 'opacity-80'}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-1 pl-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 className="display">{habit.title}</h3>
            <StatChip stat={habit.stat} />
          </div>
          <p className="text-muted text-sm">{habitSummary(habit)}</p>
          <p className="text-muted flex flex-wrap items-center gap-x-3 text-xs">
            <span>{scheduleLabel(habit.schedule)}</span>
            {streak && streak.longest > 0 && (
              <span className="flex items-center gap-1 tabular-nums">
                <Flame aria-hidden size={12} />
                {streak.streak} · best {streak.longest}
              </span>
            )}
          </p>
        </div>
        {active && (
          <button
            type="button"
            aria-pressed={habit.core}
            disabled={busy || (!habit.core && coreFull)}
            onClick={() =>
              void run({ type: 'habit.update', payload: { id, changes: { core: !habit.core } } })
            }
            className={`pill hover:bg-surface-2 flex min-h-11 items-center gap-1 px-3 text-sm disabled:opacity-40 ${
              habit.core ? 'text-warning-text font-medium' : 'text-muted'
            }`}
          >
            <Star aria-hidden size={18} fill={habit.core ? 'currentColor' : 'none'} />
            Core
          </button>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Edit ${habit.title}`}
          onClick={toggleOpen}
          className="text-muted hover:text-text hover:bg-surface-2 flex size-11 items-center justify-center rounded-full"
        >
          <ChevronDown
            aria-hidden
            size={20}
            className={`transition-transform duration-(--dur-fast) ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {open && (
        <div className="border-border mt-3 flex flex-col gap-4 border-t pt-3">
          <HabitEditor habit={draft} onChange={setDraft} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || problems.length > 0} onClick={() => void save()}>
              Save
            </Button>
            <Button variant="secondary" disabled={busy} onClick={toggleOpen}>
              Cancel
            </Button>
          </div>
          <div className="border-border flex flex-wrap gap-2 border-t pt-3">
            {active && onMove && (
              <>
                <Button
                  variant="ghost"
                  disabled={busy || first}
                  onClick={() => onMove(-1)}
                  aria-label={`Move ${habit.title} up`}
                >
                  <ArrowUp aria-hidden size={18} /> Up
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || last}
                  onClick={() => onMove(1)}
                  aria-label={`Move ${habit.title} down`}
                >
                  <ArrowDown aria-hidden size={18} /> Down
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void run({ type: 'habit.pause', payload: { id } })}
                >
                  Pause
                </Button>
              </>
            )}
            {!active && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void run({ type: 'habit.restore', payload: { id } })}
              >
                Restore
              </Button>
            )}
            {habit.status !== 'archived' && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => void run({ type: 'habit.archive', payload: { id } })}
              >
                Archive
              </Button>
            )}
            {!active && !confirmDelete && (
              <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(true)}>
                Delete…
              </Button>
            )}
          </div>
          {confirmDelete && (
            <Confirm
              danger
              label="Delete forever?"
              confirmLabel="Delete forever"
              cancelLabel="Keep it"
              busy={busy}
              onConfirm={() => void run({ type: 'habit.delete', payload: { id, confirm: true } })}
              onCancel={() => setConfirmDelete(false)}
            >
              <p>
                Delete “{habit.title}” forever? Past days keep their history, but it can’t be
                restored.
              </p>
            </Confirm>
          )}
          {active && (
            <p className="text-muted text-xs">
              Pause or archive takes it off today’s list if it isn’t done yet. Core changes apply
              from tomorrow. Up to {GAME.maxCoreHabits} core quests.
            </p>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-warning-text mt-2 text-sm">
          {error}
        </p>
      )}
    </li>
  );
}
