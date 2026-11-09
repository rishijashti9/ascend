import { Leaf } from 'lucide-react';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { recordAnswer, useShown } from '@/ui/hooks/useShown';
import { useBurnoutCard } from './suggestionHooks';

/**
 * Early burnout warning (SPEC 6.7 A): what the System noticed, and a lighter week on offer —
 * smaller targets through Plan history, with Undo. Never more load, never less sleep.
 */
export function BurnoutCard() {
  const card = useBurnoutCard();
  const { run, busy, error } = useAction();
  useShown(card?.kind === 'warn' ? 'burnout' : null);
  if (!card) return null;

  if (card.kind === 'applied') {
    return (
      <section
        aria-label="Suggestion"
        className="panel flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
      >
        <span className="flex-1">{card.summary}</span>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void run({ type: 'plan.undo', payload: { id: card.historyId } })}
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
  return (
    <section aria-label="Suggestion" className="panel flex flex-col gap-3 p-4 text-sm">
      <p className="flex items-start gap-2">
        <Leaf aria-hidden size={18} className="text-accent-text mt-0.5 shrink-0" />
        <span>{card.why}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() => void run({ type: 'adaptive.lighterWeek', payload: {} })}
        >
          Make this week lighter
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => recordAnswer('burnout', null, 'rejected')}
        >
          Not now
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
