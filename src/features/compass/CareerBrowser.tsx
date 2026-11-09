import { useState } from 'react';
import { careersIn } from '@/core/compass/careers';
import { onetUrl } from '@/core/compass/pack';
import { useAppState } from '@/core/state/app';
import { FIELDS, type CareerField } from '@/data/compass/schema';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';

const FIELD_LABEL: Record<CareerField, string> = {
  tech: 'Tech',
  engineering: 'Engineering',
  science: 'Science',
  health: 'Health',
  business: 'Business and law',
  creative: 'Creative',
  trades: 'Skilled trades',
  education: 'Education',
  public: 'Public service',
};

/** Browse every career in the knowledge pack by field (SPEC 6.7 B). */
export function CareerBrowser() {
  const [field, setField] = useState<CareerField>('tech');
  const target = useAppState((s) => s.profile?.compass?.target_career ?? null);
  const { run, busy } = useAction();
  const careers = careersIn(field);
  return (
    <section aria-label="Browse careers" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Browse careers</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Field</span>
        <select
          className="control min-h-11 px-3"
          value={field}
          onChange={(e) => setField(e.target.value as CareerField)}
        >
          {FIELDS.map((f) => (
            <option key={f} value={f}>
              {FIELD_LABEL[f]}
            </option>
          ))}
        </select>
      </label>
      <ul className="flex flex-col gap-2">
        {careers.map((c) => (
          <li key={c.id} className="panel flex flex-col gap-1 p-4">
            <h3 className="font-medium">{c.title}</h3>
            <p className="text-muted text-sm">{c.summary}</p>
            <p className="text-sm">
              <span className="text-muted">Route: </span>
              {c.entry}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {target === c.id ? (
                <span className="text-success-text text-sm">Your target career</span>
              ) : (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run({ type: 'compass.setTarget', payload: { career_id: c.id } })
                  }
                >
                  Work towards this
                </Button>
              )}
              {c.onet && (
                <a
                  href={onetUrl(c.onet)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent-text inline-flex min-h-11 items-center text-sm"
                >
                  O*NET {c.onet}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
