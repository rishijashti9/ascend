import { useState } from 'react';
import type { BodyLog } from '@/core/db/types';
import { useBody } from '@/core/state/body';
import { useToday } from '@/core/state/today';
import { formatDay } from '@/features/goals/format';
import { Button } from '@/ui/Button';
import { Field, TextInput } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';
import { BodyTrends } from './BodyTrends';
import { Photos } from './Photos';

type Draft = Record<'weight' | 'waist' | 'sleep_hours' | 'steps' | 'workout_notes', string>;

const toDraft = (l: BodyLog | undefined): Draft => ({
  weight: l?.weight?.toString() ?? '',
  waist: l?.waist?.toString() ?? '',
  sleep_hours: l?.sleep_hours?.toString() ?? '',
  steps: l?.steps?.toString() ?? '',
  workout_notes: l?.workout_notes ?? '',
});

/** Only what changed; an emptied field clears that value. */
function changes(before: Draft, after: Draft): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = {};
  for (const key of Object.keys(after) as (keyof Draft)[]) {
    if (after[key].trim() === before[key].trim()) continue;
    const v = after[key].trim();
    out[key] = key === 'workout_notes' ? v || null : v === '' ? null : Number(v);
  }
  return out;
}

function LogForm({ day, log }: { day: string; log: BodyLog | undefined }) {
  const initial = toDraft(log);
  const [draft, setDraft] = useState(initial);
  // A change made elsewhere (a quest card, another device) shows up unless you're mid-edit.
  const [shown, setShown] = useState(initial);
  if (JSON.stringify(shown) !== JSON.stringify(initial)) {
    setShown(initial);
    if (JSON.stringify(draft) === JSON.stringify(shown)) setDraft(initial);
  }
  const [saved, setSaved] = useState(false);
  const { run, busy, error } = useAction();
  const diff = changes(initial, draft);
  const bad = Object.entries(diff).some(
    ([k, v]) => k !== 'workout_notes' && typeof v === 'number' && !Number.isFinite(v),
  );
  const set =
    (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setSaved(false);
      setDraft({ ...draft, [k]: e.target.value });
    };

  return (
    <form
      aria-label="Today’s body log"
      className="panel flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (Object.keys(diff).length === 0 || bad) return;
        void run({ type: 'body.log', payload: { day, ...diff } }).then((ok) => setSaved(ok));
      }}
    >
      <h2 className="font-semibold">Today</h2>
      <div className="grid grid-cols-2 gap-3">
        <TextInput
          label="Weight (kg)"
          type="number"
          inputMode="decimal"
          step={0.1}
          value={draft.weight}
          onChange={set('weight')}
        />
        <TextInput
          label="Waist (cm)"
          type="number"
          inputMode="decimal"
          step={0.5}
          value={draft.waist}
          onChange={set('waist')}
        />
        <TextInput
          label="Sleep (hours)"
          type="number"
          inputMode="decimal"
          step={0.25}
          value={draft.sleep_hours}
          onChange={set('sleep_hours')}
        />
        <TextInput
          label="Steps"
          type="number"
          inputMode="numeric"
          step={100}
          value={draft.steps}
          onChange={set('steps')}
        />
      </div>
      <Field label="Workout notes">
        {(id) => (
          <textarea
            id={id}
            rows={2}
            maxLength={500}
            value={draft.workout_notes}
            onChange={set('workout_notes')}
            className="control w-full p-3 text-base"
          />
        )}
      </Field>
      <p className="text-muted text-xs">
        Steps and sleep also fill in today’s Walk and Sleep quests.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || bad || Object.keys(diff).length === 0}>
          Save
        </Button>
        {saved && (
          <span role="status" className="text-success-text text-sm">
            Saved
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </form>
  );
}

const show = (v: number | null, unit: string) =>
  v === null ? '—' : `${v.toLocaleString()} ${unit}`;

/** Body (SPEC 7.6): weight, waist, sleep, steps and workouts. */
export function BodyPage() {
  const logs = useBody((s) => s.logs);
  const day = useToday((s) => s.day);
  if (!day) return null;
  const todayLog = logs.find((l) => l.day === day);
  const recent = logs.filter((l) => l.day !== day).slice(0, 14);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Body</h1>
      <LogForm key={day} day={day} log={todayLog} />
      <BodyTrends today={day} />
      <Photos day={day} />
      {recent.length > 0 && (
        <section aria-label="Recent days" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Recent days</h2>
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-muted text-left text-xs">
                <tr>
                  <th className="p-2 font-medium">Day</th>
                  <th className="p-2 font-medium">Weight</th>
                  <th className="p-2 font-medium">Waist</th>
                  <th className="p-2 font-medium">Sleep</th>
                  <th className="p-2 font-medium">Steps</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((l) => (
                  <tr key={l.id} className="border-border border-t">
                    <td className="p-2">{formatDay(l.day)}</td>
                    <td className="p-2">{show(l.weight, 'kg')}</td>
                    <td className="p-2">{show(l.waist, 'cm')}</td>
                    <td className="p-2">{show(l.sleep_hours, 'h')}</td>
                    <td className="p-2">{show(l.steps, '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
