import { useState } from 'react';
import type { Review } from '@/core/db/types';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { useAction } from '@/ui/hooks/useAction';

const TEXTAREA = 'control w-full p-3 text-base';

function Scale({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${label} ${n} of 5`}
            onClick={() => onChange(n)}
            className={`min-h-11 flex-1 rounded-md border text-base tabular-nums ${
              value === n ? 'border-accent bg-surface-2 font-semibold' : 'border-border bg-surface'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="text-muted flex justify-between text-xs">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

/** The 1-minute daily check-in (SPEC 7.7): energy, mood, one win, one lesson. */
export function DailyCheckIn({ day, existing }: { day: string; existing: Review | undefined }) {
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [win, setWin] = useState(existing?.win ?? '');
  const [lesson, setLesson] = useState(existing?.lesson ?? '');
  const [saved, setSaved] = useState(false);
  const { run, busy, error } = useAction();
  const touched = () => setSaved(false);
  const empty = energy === null && mood === null && !win.trim() && !lesson.trim();

  return (
    <form
      aria-label="Daily check-in"
      className="panel flex flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (empty) return;
        void run({
          type: 'review.save',
          payload: { type: 'daily', period: day, energy, mood, win, lesson },
        }).then(setSaved);
      }}
    >
      <div>
        <h2 className="font-semibold">Daily check-in</h2>
        <p className="text-muted text-sm">One minute. Skip anything you like.</p>
      </div>
      <Scale
        label="Energy"
        low="Drained"
        high="Full of energy"
        value={energy}
        onChange={(v) => {
          touched();
          setEnergy(v);
        }}
      />
      <Scale
        label="Mood"
        low="Low"
        high="Great"
        value={mood}
        onChange={(v) => {
          touched();
          setMood(v);
        }}
      />
      <Field label="One win">
        {(id) => (
          <textarea
            id={id}
            rows={2}
            maxLength={1000}
            value={win}
            onChange={(e) => {
              touched();
              setWin(e.target.value);
            }}
            className={TEXTAREA}
          />
        )}
      </Field>
      <Field label="One lesson">
        {(id) => (
          <textarea
            id={id}
            rows={2}
            maxLength={1000}
            value={lesson}
            onChange={(e) => {
              touched();
              setLesson(e.target.value);
            }}
            className={TEXTAREA}
          />
        )}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy || empty}>
          {existing ? 'Update check-in' : 'Save check-in'}
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
