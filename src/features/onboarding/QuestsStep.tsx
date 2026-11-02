import { Check, ChevronDown, Star } from 'lucide-react';
import { useState } from 'react';
import { GAME } from '@/config/game';
import type { Measure } from '@/core/db/types';
import { WAKE_HABIT_KEY, type StarterHabit } from '@/data/starter';
import { Select, TextInput } from '@/ui/Field';
import { StatChip } from '@/ui/stats';
import { canAddCore, questProblems, type Draft } from './draft';

type Update = (fn: (d: Draft) => Draft) => void;

const MEASURES: { value: Measure; label: string }[] = [
  { value: 'check', label: 'Done / not done' },
  { value: 'minutes', label: 'Minutes' },
  { value: 'count', label: 'Count' },
  { value: 'steps', label: 'Steps' },
  { value: 'sleep_hours', label: 'Sleep hours' },
];

const NUMERIC_DEFAULTS: Record<Exclude<Measure, 'check'>, [number, number]> = {
  minutes: [30, 10],
  count: [10, 3],
  steps: [8000, 3000],
  sleep_hours: [7.5, 6.5],
};

const UNIT: Record<Measure, string> = {
  check: '',
  minutes: ' min',
  count: '',
  steps: ' steps',
  sleep_hours: ' h',
};

function summary(h: StarterHabit): string {
  if (h.measure === 'check') return `${h.full_version} · minimum: ${h.min_version}`;
  const fmt = (v: number | null) => `${(v ?? 0).toLocaleString()}${UNIT[h.measure]}`;
  return `${fmt(h.target_value)} · minimum ${fmt(h.min_value)}`;
}

function changeMeasure(h: StarterHabit, measure: Measure): StarterHabit {
  if (measure === 'check') {
    return {
      ...h,
      measure,
      target_value: null,
      min_value: null,
      full_version: '',
      min_version: '',
    };
  }
  const [target, min] = NUMERIC_DEFAULTS[measure];
  return { ...h, measure, target_value: target, min_value: min, full_version: '', min_version: '' };
}

const num = (v: string) => (v.trim() === '' ? null : Number(v));

function QuestEditor({
  habit,
  onChange,
}: {
  habit: StarterHabit;
  onChange: (h: StarterHabit) => void;
}) {
  const wake = habit.key === WAKE_HABIT_KEY;
  const problems = questProblems(habit);
  return (
    <div className="border-border mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
      <TextInput
        label="Title"
        value={habit.title}
        maxLength={80}
        onChange={(e) => onChange({ ...habit, title: e.target.value })}
      />
      <Select
        label="Stat"
        value={habit.stat}
        options={[
          { value: 'STR', label: 'STR — Strength' },
          { value: 'INT', label: 'INT — Intellect' },
          { value: 'WIL', label: 'WIL — Willpower' },
        ]}
        onChange={(e) => onChange({ ...habit, stat: e.target.value as StarterHabit['stat'] })}
      />
      <Select
        label="Difficulty"
        value={habit.difficulty}
        options={(['easy', 'normal', 'hard', 'epic'] as const).map((d) => ({
          value: d,
          label: `${d[0]?.toUpperCase()}${d.slice(1)} — ${GAME.xpByDifficulty[d]} XP`,
        }))}
        onChange={(e) =>
          onChange({ ...habit, difficulty: e.target.value as StarterHabit['difficulty'] })
        }
      />
      {wake ? (
        <p className="text-muted self-end text-sm">
          Completed with the “I’m up” button. The times follow your wake-up time.
        </p>
      ) : (
        <Select
          label="Measured in"
          value={habit.measure}
          options={MEASURES}
          onChange={(e) => onChange(changeMeasure(habit, e.target.value as Measure))}
        />
      )}
      {!wake && habit.measure === 'check' && (
        <>
          <TextInput
            label="Full version"
            value={habit.full_version}
            maxLength={120}
            onChange={(e) => onChange({ ...habit, full_version: e.target.value })}
          />
          <TextInput
            label="Minimum version"
            value={habit.min_version}
            maxLength={120}
            onChange={(e) => onChange({ ...habit, min_version: e.target.value })}
          />
        </>
      )}
      {habit.measure !== 'check' && (
        <>
          <TextInput
            label={`Target${UNIT[habit.measure]}`}
            type="number"
            inputMode="decimal"
            min={0}
            step={habit.measure === 'sleep_hours' ? 0.5 : 1}
            value={habit.target_value ?? ''}
            onChange={(e) => onChange({ ...habit, target_value: num(e.target.value) })}
          />
          <TextInput
            label={`Minimum${UNIT[habit.measure]}`}
            type="number"
            inputMode="decimal"
            min={0}
            step={habit.measure === 'sleep_hours' ? 0.5 : 1}
            value={habit.min_value ?? ''}
            onChange={(e) => onChange({ ...habit, min_value: num(e.target.value) })}
          />
        </>
      )}
      {problems.length > 0 && (
        <p role="alert" className="text-warning-text text-sm sm:col-span-2">
          {problems.join(' · ')}
        </p>
      )}
    </div>
  );
}

function QuestRow({ habit, draft, update }: { habit: StarterHabit; draft: Draft; update: Update }) {
  const [open, setOpen] = useState(false);
  const set = (next: StarterHabit) =>
    update((d) => ({ ...d, habits: d.habits.map((h) => (h.key === habit.key ? next : h)) }));
  const coreLocked = !habit.core && (!habit.selected || !canAddCore(draft));

  return (
    <li
      className={`border-border bg-surface shadow-card rounded-lg border p-3 ${habit.selected ? '' : 'opacity-70'}`}
    >
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
          <p className="text-muted text-sm">{summary(habit)}</p>
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
      {open && <QuestEditor habit={habit} onChange={set} />}
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
      <ul className="flex flex-col gap-2">
        {draft.habits.map((h) => (
          <QuestRow key={h.key} habit={h} draft={draft} update={update} />
        ))}
      </ul>
    </div>
  );
}
