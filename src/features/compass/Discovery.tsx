import { Check, RotateCcw, Target } from 'lucide-react';
import { useState } from 'react';
import { discoveryReady, matchCareers, type DiscoveryAnswers } from '@/core/compass/discovery';
import { useAppState } from '@/core/state/app';
import { INTEREST_ITEMS, STRENGTHS, VALUES } from '@/data/compass/discovery';
import { ONET_ATTRIBUTION } from '@/data/compass';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';

type Step = 'interests' | 'strengths' | 'values' | 'results';
const LEVELS: { v: 0 | 1 | 2; label: string }[] = [
  { v: 0, label: 'Not for me' },
  { v: 1, label: 'Maybe' },
  { v: 2, label: 'Yes please' },
];

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3 text-sm ${
        on ? 'border-accent bg-accent-fill text-on-accent' : 'border-border bg-surface'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Guided career discovery (SPEC 6.7 B): what you enjoy (Holland / RIASEC), your strengths and
 * what you value → careers that fit, each with why. Answers are saved on your profile.
 */
export function Discovery() {
  const saved = useAppState((s) => s.profile?.compass?.discovery);
  const target = useAppState((s) => s.profile?.compass?.target_career ?? null);
  const [step, setStep] = useState<Step>(saved ? 'results' : 'interests');
  const [answers, setAnswers] = useState<DiscoveryAnswers>(
    saved
      ? { interests: saved.interests, strengths: saved.strengths, values: saved.values }
      : { interests: {}, strengths: [], values: [] },
  );
  const { run, busy, error } = useAction();
  const toggle = (key: 'strengths' | 'values', id: string) =>
    setAnswers((a) => {
      const list = a[key].includes(id) ? a[key].filter((x) => x !== id) : [...a[key], id];
      return { ...a, [key]: list.slice(-3) };
    });

  if (step === 'interests') {
    return (
      <section aria-label="What you enjoy" className="flex flex-col gap-3">
        <p className="text-muted text-sm">How would you feel about doing these? (Step 1 of 3)</p>
        <ul className="flex flex-col gap-3">
          {INTEREST_ITEMS.map((item) => (
            <li key={item.id} className="flex flex-col gap-1">
              <span>{item.text}</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label={item.text}>
                {LEVELS.map((l) => (
                  <Chip
                    key={l.v}
                    on={answers.interests[item.id] === l.v}
                    onClick={() =>
                      setAnswers((a) => ({ ...a, interests: { ...a.interests, [item.id]: l.v } }))
                    }
                  >
                    {l.label}
                  </Chip>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <Button disabled={!discoveryReady(answers)} onClick={() => setStep('strengths')}>
          Next
        </Button>
      </section>
    );
  }

  if (step === 'strengths' || step === 'values') {
    const list = step === 'strengths' ? STRENGTHS : VALUES;
    const key = step;
    return (
      <section
        aria-label={step === 'strengths' ? 'Your strengths' : 'What you value'}
        className="flex flex-col gap-3"
      >
        <p className="text-muted text-sm">
          {step === 'strengths'
            ? 'What are you good at? Pick up to 3. (Step 2 of 3)'
            : 'What matters most in your work? Pick up to 3. (Step 3 of 3)'}
        </p>
        <div className="flex flex-wrap gap-2">
          {list.map((x) => (
            <Chip key={x.id} on={answers[key].includes(x.id)} onClick={() => toggle(key, x.id)}>
              {x.label}
            </Chip>
          ))}
        </div>
        <Button
          disabled={busy}
          onClick={() => {
            if (step === 'strengths') setStep('values');
            else
              void run({ type: 'compass.saveDiscovery', payload: answers }).then(
                (ok) => ok && setStep('results'),
              );
          }}
        >
          {step === 'strengths' ? 'Next' : 'See my matches'}
        </Button>
        {error && (
          <p role="alert" className="text-warning-text text-sm">
            {error}
          </p>
        )}
      </section>
    );
  }

  const matches = matchCareers(answers);
  return (
    <section aria-label="Careers that fit you" className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {matches.map(({ career, score, why }) => (
          <li
            key={career.id}
            className="border-border bg-surface flex flex-col gap-2 rounded-lg border p-4"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-medium">{career.title}</h3>
              <span className="text-muted text-sm tabular-nums">{score}% fit</span>
            </div>
            <p className="text-muted text-sm">{career.summary}</p>
            <p className="text-sm">{why}</p>
            {target === career.id ? (
              <p className="text-success-text flex items-center gap-1 text-sm">
                <Check aria-hidden size={16} /> Your target career
              </p>
            ) : (
              <Button
                variant="secondary"
                className="self-start"
                disabled={busy}
                onClick={() =>
                  void run({ type: 'compass.setTarget', payload: { career_id: career.id } })
                }
              >
                <Target aria-hidden size={16} /> Work towards this
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="self-start" onClick={() => setStep('interests')}>
        <RotateCcw aria-hidden size={16} /> Retake
      </Button>
      <p className="text-muted text-xs">{ONET_ATTRIBUTION}</p>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
