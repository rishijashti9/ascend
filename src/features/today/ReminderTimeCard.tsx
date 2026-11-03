import { BellRing } from 'lucide-react';
import { parseTime } from '@/core/time';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { recordAnswer, useShown } from '@/ui/hooks/useShown';
import { useReminderCard } from './suggestionHooks';

/**
 * Learned reminder time (SPEC 6.7 A): "You usually finish your core quests between 20:00 and
 * 22:00. Move the core-quest reminder from 18:00 to 19:30?" — one tap, with Undo.
 */
export function ReminderTimeCard() {
  const card = useReminderCard();
  const { run, busy, error } = useAction();
  useShown(card?.kind === 'suggest' ? 'reminder_time' : null);
  if (!card) return null;
  const values = { from_min: parseTime(card.from), to_min: parseTime(card.to) };
  const setTime = (time: string) =>
    run({ type: 'settings.update', payload: { notifications: { reminder_time: time } } });

  if (card.kind === 'applied') {
    return (
      <section
        aria-label="Suggestion"
        className="border-border bg-surface flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm"
      >
        <span className="flex-1">Core-quest reminder moved to {card.to}.</span>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void setTime(card.from).then((ok) => {
              if (ok) recordAnswer('reminder_time', null, 'rejected', { ...values, undone: 1 });
            })
          }
        >
          Undo
        </Button>
      </section>
    );
  }
  return (
    <section
      aria-label="Suggestion"
      className="border-border bg-surface shadow-card flex flex-col gap-3 rounded-lg border p-4 text-sm"
    >
      <p className="flex items-start gap-2">
        <BellRing aria-hidden size={18} className="text-accent-text mt-0.5 shrink-0" />
        <span>
          {card.why} Move the core-quest reminder from {card.from} to {card.to}, so it comes just
          before you usually start?
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            void setTime(card.to).then((ok) => {
              if (ok) recordAnswer('reminder_time', null, 'accepted', values);
            })
          }
        >
          Move to {card.to}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => recordAnswer('reminder_time', null, 'rejected', values)}
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
