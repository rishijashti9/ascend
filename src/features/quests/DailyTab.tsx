import { Plus } from 'lucide-react';
import { useState } from 'react';
import { GAME } from '@/config/game';
import type { Habit } from '@/core/db/types';
import type { HabitStreak } from '@/core/engine/streaks';
import { useHabits } from '@/core/state/habits';
import { useProgress } from '@/core/state/progress';
import { Button } from '@/ui/Button';
import { editProblems, type EditableHabit } from '@/ui/habit/habitEdit';
import { HabitEditor } from '@/ui/habit/HabitEditor';
import { useAction } from '@/ui/hooks/useAction';
import { HabitRow } from './HabitRow';

/** Stable empty value: a new `{}` on every render would make the store re-render forever. */
const NO_STREAKS: Record<string, HabitStreak> = {};

const NEW_HABIT: EditableHabit = {
  title: '',
  stat: 'INT',
  difficulty: 'normal',
  measure: 'check',
  target_value: null,
  min_value: null,
  full_version: '',
  min_version: '',
  auto_source: 'none',
  schedule: [0, 1, 2, 3, 4, 5, 6],
  skill_ids: [],
};

function NewHabit({ onDone }: { onDone: () => void }) {
  const [draft, setDraft] = useState<EditableHabit>(NEW_HABIT);
  const { run, busy, error } = useAction();
  const problems = editProblems(draft);
  const create = async () => {
    const ok = await run({
      type: 'habit.create',
      payload: { ...draft, title: draft.title.trim() },
    });
    if (ok) onDone();
  };
  return (
    <section
      aria-label="New daily quest"
      className="border-accent bg-surface shadow-card flex flex-col gap-4 rounded-lg border p-4"
    >
      <h2 className="font-semibold">New daily quest</h2>
      <HabitEditor habit={draft} onChange={setDraft} />
      <p className="text-muted text-xs">
        It appears today. It can be made core from the list — core counts from tomorrow.
      </p>
      <div className="flex gap-2">
        <Button disabled={busy || problems.length > 0} onClick={() => void create()}>
          Add quest
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

function Section({ title, habits, hint }: { title: string; habits: Habit[]; hint: string }) {
  const streaks = useProgress((s) => s.progress?.habitStreaks ?? NO_STREAKS);
  if (habits.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        {title} <span className="text-muted text-sm font-normal">· {hint}</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {habits.map((h) => (
          <HabitRow key={h.id} habit={h} streak={streaks[h.id]} coreFull={false} />
        ))}
      </ul>
    </section>
  );
}

/** Quests screen, Daily tab (SPEC 7.3): habits with full/minimum versions and core flags. */
export function DailyTab() {
  const habits = useHabits((s) => s.habits);
  const streaks = useProgress((s) => s.progress?.habitStreaks ?? NO_STREAKS);
  const [adding, setAdding] = useState(false);
  const { run } = useAction();

  const active = habits.filter((h) => h.status === 'active');
  const paused = habits.filter((h) => h.status === 'paused');
  const archived = habits.filter((h) => h.status === 'archived');
  const coreFull = active.filter((h) => h.core).length >= GAME.maxCoreHabits;

  const move = (index: number, direction: -1 | 1) => {
    const ids = active.map((h) => h.id);
    const [moved] = ids.splice(index, 1);
    if (!moved) return;
    ids.splice(index + direction, 0, moved);
    // Paused and archived keep their places after the active ones.
    void run({
      type: 'habit.reorder',
      payload: { ids: [...ids, ...paused.map((h) => h.id), ...archived.map((h) => h.id)] },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {!adding && (
        <Button className="self-end" onClick={() => setAdding(true)}>
          <Plus aria-hidden size={18} />
          New quest
        </Button>
      )}

      {adding && <NewHabit onDone={() => setAdding(false)} />}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">
          Daily quests{' '}
          <span className="text-muted text-sm font-normal">
            · {active.filter((h) => h.core).length} of {GAME.maxCoreHabits} core
          </span>
        </h2>
        {active.length === 0 ? (
          <p className="panel p-4">
            No daily quests yet. Add one small thing you want to do every day.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((h, i) => (
              <HabitRow
                key={h.id}
                habit={h}
                streak={streaks[h.id]}
                coreFull={coreFull}
                onMove={(d) => move(i, d)}
                first={i === 0}
                last={i === active.length - 1}
              />
            ))}
          </ul>
        )}
      </section>

      <Section title="Paused" habits={paused} hint="not scheduled until restored" />
      <Section title="Archived" habits={archived} hint="kept for history" />
    </div>
  );
}
