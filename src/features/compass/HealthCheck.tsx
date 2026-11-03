import { HeartPulse, Pencil } from 'lucide-react';
import { useState } from 'react';
import { HEALTH_GOALS, healthGap, type GapStatus, type HealthCheckIn } from '@/core/compass/health';
import { sourceById } from '@/core/compass/pack';
import { countryFromTimeZone } from '@/core/compass/safety';
import { useAdaptive } from '@/core/state/adaptive';
import { useAppState } from '@/core/state/app';
import { currentTimeZone } from '@/core/time';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';

const STATUS: Record<GapStatus, { label: string; cls: string }> = {
  meets: { label: 'Meets it', cls: 'text-success-text' },
  close: { label: 'Close', cls: 'text-accent-text' },
  below: { label: 'Below', cls: 'text-warning-text' },
  unknown: { label: '', cls: 'text-muted' },
};

function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { v: T; text: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-sm">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={value === o.v}
            onClick={() => onChange(o.v)}
            className={`min-h-11 rounded-full border px-3 text-sm ${
              value === o.v
                ? 'border-accent bg-accent-fill text-on-accent'
                : 'border-border bg-surface'
            }`}
          >
            {o.text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Guided health check-in + gap analysis against WHO and sleep-science guidelines (SPEC 6.7 B).
 * Uses real data first; nothing here ever leaves the device or the user's own account.
 */
export function HealthCheck() {
  const saved = useAppState((s) => s.profile?.compass?.health) as
    (HealthCheckIn & { at: string }) | undefined;
  const input = useAdaptive((s) => s.input);
  const [editing, setEditing] = useState(!saved);
  const [draft, setDraft] = useState<Partial<HealthCheckIn>>(saved ?? { goals: [] });
  const { run, busy, error } = useAction();
  const complete =
    draft.activity &&
    draft.strengthDays !== undefined &&
    draft.sleep &&
    draft.energy &&
    draft.goals;

  if (editing) {
    return (
      <section aria-label="Health check-in" className="flex flex-col gap-4">
        <p className="text-muted text-sm">
          A minute of questions. Stays on this device and your own account.
        </p>
        <Choice
          label="How active are you in a usual week?"
          value={draft.activity}
          onChange={(activity) => setDraft({ ...draft, activity })}
          options={[
            { v: 'none', text: 'Hardly' },
            { v: 'light', text: 'A little' },
            { v: 'moderate', text: 'Moderately' },
            { v: 'active', text: 'Very' },
          ]}
        />
        <Choice
          label="Strength training days a week?"
          value={draft.strengthDays}
          onChange={(strengthDays) => setDraft({ ...draft, strengthDays })}
          options={[
            { v: 0, text: '0' },
            { v: 1, text: '1' },
            { v: 2, text: '2' },
            { v: 3, text: '3+' },
          ]}
        />
        <Choice
          label="How long do you usually sleep?"
          value={draft.sleep}
          onChange={(sleep) => setDraft({ ...draft, sleep })}
          options={[
            { v: 'under6', text: 'Under 6 h' },
            { v: '6to7', text: '6–7 h' },
            { v: '7to8', text: '7–8 h' },
            { v: 'over8', text: '8 h+' },
          ]}
        />
        <Choice
          label="Energy lately?"
          value={draft.energy}
          onChange={(energy) => setDraft({ ...draft, energy })}
          options={[1, 2, 3, 4, 5].map((v) => ({
            v: v as HealthCheckIn['energy'],
            text: ['Drained', 'Low', 'OK', 'Good', 'Great'][v - 1] ?? '',
          }))}
        />
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm">What would you like? (any)</legend>
          <div className="flex flex-wrap gap-2">
            {HEALTH_GOALS.map((g) => {
              const on = draft.goals?.includes(g.id) ?? false;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      goals: on
                        ? (draft.goals ?? []).filter((x) => x !== g.id)
                        : [...(draft.goals ?? []), g.id],
                    })
                  }
                  className={`min-h-11 rounded-full border px-3 text-sm ${on ? 'border-accent bg-accent-fill text-on-accent' : 'border-border bg-surface'}`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <Button
          disabled={!complete || busy}
          onClick={() =>
            void run({ type: 'compass.saveHealth', payload: draft }).then(
              (ok) => ok && setEditing(false),
            )
          }
        >
          See my health picture
        </Button>
        {error && (
          <p role="alert" className="text-warning-text text-sm">
            {error}
          </p>
        )}
      </section>
    );
  }

  if (!input) return null;
  const gap = healthGap(input, saved ?? null, countryFromTimeZone(currentTimeZone()));
  return (
    <section aria-label="Your health picture" className="flex flex-col gap-3">
      {gap.safety.map((s) => (
        <p
          key={s.kind}
          role="note"
          className="border-warning bg-surface rounded-lg border p-4 text-sm"
        >
          {s.text}
        </p>
      ))}
      <ul className="border-border bg-surface divide-border flex flex-col divide-y rounded-lg border">
        {gap.items.map(({ guideline, status, yours }) => (
          <li key={guideline.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2 font-medium">
                <HeartPulse aria-hidden size={16} className="text-accent-text" /> {guideline.title}
              </span>
              {STATUS[status].label && (
                <span className={`text-sm ${STATUS[status].cls}`}>{STATUS[status].label}</span>
              )}
            </div>
            {yours && <p className="text-sm">{yours}</p>}
            <p className="text-muted text-sm">{guideline.text}</p>
            <p className="text-muted text-xs">
              {guideline.audience} · Source:{' '}
              {guideline.sources.map((id, i) => (
                <span key={id}>
                  {i > 0 && ', '}
                  <a
                    className="text-accent-text"
                    href={sourceById(id)?.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {sourceById(id)?.publisher ?? id}
                  </a>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
      {gap.lowEnergyDays >= 6 && (
        <p className="text-muted text-sm">
          {gap.lowEnergyDays} low-energy days in the last 4 weeks — sleep and recovery come before
          more training.
        </p>
      )}
      <p className="text-muted text-xs">
        General guidance for healthy adults, not medical advice. For pain, illness or anything that
        worries you, please see a doctor.
      </p>
      <Button variant="ghost" className="self-start" onClick={() => setEditing(true)}>
        <Pencil aria-hidden size={16} /> Update check-in
      </Button>
    </section>
  );
}
