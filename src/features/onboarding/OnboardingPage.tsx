import { useMemo, useState } from 'react';
import { DEFAULT_SETTINGS } from '@/config/defaults';
import { Robot } from '@/ui/Robot';
import { logError } from '@/core/errorLog';
import { recordAction } from '@/core/pipeline';
import { useAppState } from '@/core/state/app';
import { currentTimeZone, localParts, nowMs } from '@/core/time';
import { Button } from '@/ui/Button';
import { initialDraft, stepProblem, toPayload, type Draft } from './draft';
import { QuestsStep } from './QuestsStep';
import { GoalsStep, NameStep, ThemeStep, WakeStep } from './steps';

const TITLES = ['Welcome', 'Wake-up time', 'Daily quests', 'Dream & Main Quests', 'Look & start'];

/** Onboarding "Awakening" (SPEC 7.1): five short steps, all pre-filled — mostly just confirm. */
export function OnboardingPage() {
  const settings = useAppState((s) => s.settings);
  const timing = {
    wake_window_min: settings?.wake_window_min ?? DEFAULT_SETTINGS.wake_window_min,
    wake_late_cutoff: settings?.wake_late_cutoff ?? DEFAULT_SETTINGS.wake_late_cutoff,
  };
  const dayStartHour = settings?.day_start_hour ?? DEFAULT_SETTINGS.day_start_hour;
  // After 6 PM (or after midnight but before the day-start hour) the day is nearly over.
  const lateStart = useMemo(() => {
    const { hour } = localParts(nowMs(), currentTimeZone());
    return hour >= 18 || hour < dayStartHour;
  }, [dayStartHour]);

  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (fn: (d: Draft) => Draft) => setDraft(fn);

  const problem = stepProblem(draft, step);
  const last = step === TITLES.length - 1;

  async function begin() {
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload({ ...draft, start: lateStart ? draft.start : 'today' }, timing);
      await recordAction({ type: 'onboarding.complete', payload });
      // The app switches to Today when the profile reloads.
    } catch (e) {
      logError(e, 'onboarding');
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="bg-bg min-h-dvh">
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Robot size={32} mood={step === TITLES.length - 1 ? 'happy' : 'idle'} />
              <span className="display text-muted text-sm tracking-widest">AWAKENING</span>
            </span>
            <span className="text-muted text-sm tabular-nums">
              Step {step + 1} of {TITLES.length}
            </span>
          </div>
          <div className="flex gap-1" aria-hidden>
            {TITLES.map((t, i) => (
              <div
                key={t}
                className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-accent' : 'bg-surface-2'}`}
              />
            ))}
          </div>
          <h1 className="display text-2xl">{TITLES[step]}</h1>
        </header>

        <section className="flex-1">
          {step === 0 && <NameStep draft={draft} update={update} />}
          {step === 1 && <WakeStep draft={draft} update={update} timing={timing} />}
          {step === 2 && <QuestsStep draft={draft} update={update} />}
          {step === 3 && <GoalsStep draft={draft} update={update} />}
          {step === 4 && <ThemeStep draft={draft} update={update} lateStart={lateStart} />}
        </section>

        <footer className="bg-bg border-border sticky bottom-0 flex flex-col gap-2 border-t pt-4 pb-2">
          {(error ?? problem) && (
            <p role="alert" className={`text-sm ${error ? 'text-error-text' : 'text-muted'}`}>
              {error ?? problem}
            </p>
          )}
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={saving}>
                Back
              </Button>
            )}
            <Button
              className="flex-1"
              disabled={problem !== null || saving}
              onClick={() => (last ? void begin() : setStep(step + 1))}
            >
              {last ? (saving ? 'Starting…' : 'Begin') : 'Next'}
            </Button>
          </div>
        </footer>
      </main>
    </div>
  );
}
