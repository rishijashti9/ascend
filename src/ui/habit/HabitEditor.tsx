import { GAME } from '@/config/game';
import type { Measure, Weekday } from '@/core/db/types';
import { Select, TextInput } from '@/ui/Field';
import {
  changeMeasure,
  editProblems,
  MEASURES,
  UNIT,
  WEEKDAYS,
  type EditableHabit,
} from './habitEdit';

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/**
 * Edits a habit's title, stat, difficulty, measure, full/minimum versions and (when the habit
 * has a `schedule`) its weekdays. The wake-up quest is completed with "I'm up", so its measure
 * and wording aren't editable here.
 */
export function HabitEditor<T extends EditableHabit>({
  habit,
  onChange,
}: {
  habit: T;
  onChange: (h: T) => void;
}) {
  const wake = habit.auto_source === 'wake_checkin';
  const problems = editProblems(habit);
  const schedule = habit.schedule;
  const toggleDay = (day: Weekday) => {
    if (!schedule) return;
    const next = schedule.includes(day) ? schedule.filter((d) => d !== day) : [...schedule, day];
    onChange({ ...habit, schedule: next.sort((a, b) => a - b) });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
        onChange={(e) => onChange({ ...habit, stat: e.target.value as T['stat'] })}
      />
      <Select
        label="Difficulty"
        value={habit.difficulty}
        options={(['easy', 'normal', 'hard', 'epic'] as const).map((d) => ({
          value: d,
          label: `${d[0]?.toUpperCase()}${d.slice(1)} — ${GAME.xpByDifficulty[d]} XP`,
        }))}
        onChange={(e) => onChange({ ...habit, difficulty: e.target.value as T['difficulty'] })}
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
      {schedule && (
        <fieldset className="flex flex-col gap-1 sm:col-span-2">
          <legend className="mb-1 text-sm font-medium">Days</legend>
          <div className="flex gap-1">
            {WEEKDAYS.map((w) => (
              <button
                key={w.day}
                type="button"
                aria-pressed={schedule.includes(w.day)}
                aria-label={w.long}
                onClick={() => toggleDay(w.day)}
                className={`size-11 rounded-md border text-sm font-medium ${
                  schedule.includes(w.day)
                    ? 'bg-accent-fill text-on-accent border-transparent'
                    : 'border-border text-muted'
                }`}
              >
                {w.short}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {problems.length > 0 && (
        <p role="alert" className="text-warning-text text-sm sm:col-span-2">
          {problems.join(' · ')}
        </p>
      )}
    </div>
  );
}
