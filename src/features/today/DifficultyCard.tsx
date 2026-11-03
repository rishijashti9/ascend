import { HeartHandshake, SlidersHorizontal } from 'lucide-react';
import type { HabitChange, Suggestion } from '@/core/engine/difficulty';
import { useGoals } from '@/core/state/goals';
import { useSuggestion } from '@/core/state/suggestion';
import { useToday } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { useShown } from '@/ui/hooks/useShown';

const UNIT: Record<string, string> = { minutes: ' min', steps: ' steps', count: '' };
const fmt = (c: HabitChange, v: number) => `${v.toLocaleString()}${UNIT[c.measure] ?? ''}`;

/**
 * One calm suggestion from the System about difficulty (SPEC 6.1) or a run of low-energy days
 * (SPEC 7). Applying changes targets with one tap and leaves an Undo note; "Not now" hides it.
 */

export function DifficultyCard() {
  const suggestion = useSuggestion((s) => s.suggestion);
  const day = useToday((s) => s.day);
  const history = useGoals((s) => s.history);
  const { run, busy, error } = useAction();
  const applied = history.find(
    (h) => !h.undone_at && day && h.trigger.startsWith('difficulty:') && h.trigger.endsWith(day),
  );

  if (applied) {
    return (
      <section
        aria-label="Suggestion"
        className="border-border bg-surface flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm"
      >
        <span className="flex-1">{applied.summary}</span>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void run({ type: 'plan.undo', payload: { id: applied.id } })}
        >
          Undo
        </Button>
        {error && (
          <p role="alert" className="text-warning-text w-full">
            {error}
          </p>
        )}
      </section>
    );
  }
  if (!suggestion) return null;
  return <SuggestionBody suggestion={suggestion} run={run} busy={busy} error={error} />;
}

function SuggestionBody({
  suggestion,
  run,
  busy,
  error,
}: {
  suggestion: Suggestion;
} & Pick<ReturnType<typeof useAction>, 'run' | 'busy' | 'error'>) {
  const { kind, changes } = suggestion;
  useShown(`difficulty_${kind}`);
  const notNow = () => void run({ type: 'difficulty.snooze', payload: { kind } });
  const Icon = kind === 'low_energy' ? HeartHandshake : SlidersHorizontal;

  return (
    <section
      aria-label="Suggestion"
      className="border-border bg-surface shadow-card flex flex-col gap-3 rounded-lg border p-4 text-sm"
    >
      <p className="flex items-start gap-2">
        <Icon aria-hidden size={18} className="text-accent-text mt-0.5 shrink-0" />
        <span>
          {kind === 'low_energy' &&
            'Low energy four days in a row. That’s okay — but is something weighing on you: sleep, too much on your plate, your health? If it keeps going, it may help to see a doctor or talk to someone you trust.'}
          {kind === 'ease' &&
            'This target is hard to reach right now. A target you hit about 4 days in 5 builds the habit faster than one you keep missing — that’s the bar being too high, not you failing. The minimum versions still keep your streak alive.'}
          {kind === 'raise' && 'Done in full on nearly every day lately. Ready for a little more?'}
        </span>
      </p>
      {changes.length > 0 && (
        <ul className="text-muted flex flex-col gap-1 pl-6">
          {changes.map((c) => (
            <li key={c.habitId}>
              {c.title}: {fmt(c, c.from)} → <span className="text-text">{fmt(c, c.to)}</span>
              <span className="block text-xs">
                Full target on {c.fullDays} of the last {c.days} days.
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {kind !== 'low_energy' && changes.length > 0 && (
          <Button
            disabled={busy}
            onClick={() => void run({ type: 'difficulty.apply', payload: { kind, changes } })}
          >
            {kind === 'raise'
              ? 'Raise it'
              : changes.length === 1
                ? 'Make it smaller'
                : 'Make these smaller'}
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={notNow}>
          {kind === 'low_energy' || changes.length === 0 ? 'Thanks' : 'Not now'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-warning-text">
          {error}
        </p>
      )}
    </section>
  );
}
