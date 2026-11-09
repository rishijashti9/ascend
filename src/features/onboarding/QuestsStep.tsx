import { Check, ChevronDown, Star } from 'lucide-react';
import { useState } from 'react';
import { GAME } from '@/config/game';
import type { StarterHabit } from '@/data/starter';
import { habitSummary } from '@/ui/habit/habitEdit';
import { HabitEditor } from '@/ui/habit/HabitEditor';
import { StatChip } from '@/ui/stats';
import { STARTER_TEMPLATES } from '@/data/starterTemplates';
import { applyTemplate, canAddCore, type Draft } from './draft';

type Update = (fn: (d: Draft) => Draft) => void;

function QuestRow({ habit, draft, update }: { habit: StarterHabit; draft: Draft; update: Update }) {
  const [open, setOpen] = useState(false);
  const set = (next: StarterHabit) =>
    update((d) => ({ ...d, habits: d.habits.map((h) => (h.key === habit.key ? next : h)) }));
  const coreLocked = !habit.core && (!habit.selected || !canAddCore(draft));

  return (
    <li className={`panel p-3 ${habit.selected ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={habit.selected}
          aria-label={`Use ${habit.title}`}
          // An unpicked quest can't be core; picking it again starts as non-core.
          onClick={() => set({ ...habit, selected: !habit.selected, core: false })}
          className={`mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-md border ${
            habit.selected ? 'bg-accent-fill text-on-accent border-transparent' : 'border-border'
          }`}
        >
          {habit.selected && <Check aria-hidden size={20} />}
        </button>
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-medium">{habit.title || 'Untitled'}</span>
            <StatChip stat={habit.stat} />
          </div>
          <p className="text-muted text-sm">{habitSummary(habit)}</p>
        </div>
        <button
          type="button"
          aria-pressed={habit.core}
          disabled={coreLocked}
          onClick={() => set({ ...habit, core: !habit.core })}
          className={`flex min-h-11 items-center gap-1 rounded-md px-2 text-sm disabled:opacity-40 ${
            habit.core ? 'text-warning-text font-medium' : 'text-muted'
          }`}
        >
          <Star aria-hidden size={18} fill={habit.core ? 'currentColor' : 'none'} />
          Core
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`Edit ${habit.title}`}
          onClick={() => setOpen(!open)}
          className="text-muted flex size-11 items-center justify-center rounded-md"
        >
          <ChevronDown
            aria-hidden
            size={20}
            className={`transition-transform duration-(--dur-fast) ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {open && (
        <div className="border-border mt-3 border-t pt-3">
          <HabitEditor habit={habit} onChange={set} />
        </div>
      )}
    </li>
  );
}

export function QuestsStep({ draft, update }: { draft: Draft; update: Update }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">
        Your daily quests, ready to go. Each has a full and a minimum version — on hard days the
        minimum still counts. Mark up to {GAME.maxCoreHabits} as <strong>core</strong>: doing at
        least their minimum makes a day active and keeps your streak.
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Start from</legend>
        <div className="flex flex-wrap gap-2">
          {STARTER_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={draft.template === t.id}
              title={t.description}
              onClick={() => update((d) => applyTemplate(d, t.id))}
              className={`min-h-11 rounded-full border px-3 text-sm ${
                draft.template === t.id
                  ? 'bg-accent-fill text-on-accent border-transparent'
                  : 'border-border bg-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-muted text-sm">
          {STARTER_TEMPLATES.find((t) => t.id === draft.template)?.description} Everything below
          stays editable.
        </p>
      </fieldset>
      <ul className="flex flex-col gap-2">
        {draft.habits.map((h) => (
          <QuestRow key={h.key} habit={h} draft={draft} update={update} />
        ))}
      </ul>
    </div>
  );
}
