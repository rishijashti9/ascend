import { useId } from 'react';
import type { Question } from '@/core/planner';

/** One interview question — tap first, typing optional (SPEC 6.3 step 2). */
export function QuestionField({
  question: q,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const chip = (selected: boolean) =>
    `pill min-h-11 px-4 text-sm font-semibold ${
      selected ? 'bg-accent-fill text-on-accent' : 'bg-surface-2 text-text'
    }`;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend id={labelId} className="display mb-1 text-base">
        {q.label}
      </legend>
      {q.kind === 'chips' && (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
          {q.options?.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={value === o.value}
              onClick={() => onChange(o.value)}
              className={chip(value === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {q.kind === 'yesno' && (
        <div role="radiogroup" aria-labelledby={labelId} className="flex gap-2">
          {[
            { v: true, l: 'Yes' },
            { v: false, l: 'No' },
          ].map(({ v, l }) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={value === v}
              onClick={() => onChange(v)}
              className={chip(value === v)}
            >
              {l}
            </button>
          ))}
        </div>
      )}
      {q.kind === 'slider' && (
        <div className="flex items-center gap-3">
          <input
            type="range"
            aria-labelledby={labelId}
            min={q.min}
            max={q.max}
            step={q.step}
            value={typeof value === 'number' ? value : Number(q.default ?? q.min ?? 0)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="accent-[var(--accent)] min-h-11 flex-1"
          />
          <output className="w-20 text-right tabular-nums">
            {typeof value === 'number' ? value : String(q.default ?? '')} {q.unit ?? ''}
          </output>
        </div>
      )}
      {q.kind === 'date' && (
        <input
          type="date"
          aria-labelledby={labelId}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="control min-h-11 px-3"
        />
      )}
      {q.kind === 'text' && (
        <input
          type="text"
          aria-labelledby={labelId}
          maxLength={200}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="control min-h-11 px-3"
        />
      )}
    </fieldset>
  );
}
