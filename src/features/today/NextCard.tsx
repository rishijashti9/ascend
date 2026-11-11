import { Timer } from 'lucide-react';
import { Link } from 'react-router';
import type { NextAction } from '@/core/adaptive/today';
import { isDone } from '@/core/engine/progress';
import { isEnabled } from '@/config/features';
import { useToday } from '@/core/state/today';

/**
 * The one next action on Today (UX-2/UX-3, docs/product/AUDIT-AND-PROPOSAL.md P1/P3). Replaces
 * the separate "Now" card and the "Today's quests" tile: one answer to "what should I do next?"
 * — the Adaptive System's pick (`whatNow`), which only considers quests that can still be done —
 * with why it was picked and the action (Start focus for a minutes quest).
 */
export function NextCard({ next, onQuests }: { next: NextAction | null; onQuests: () => void }) {
  const daily = useToday((s) => s.daily);
  const open = daily.filter((q) => !isDone(q.instance.status) && q.instance.status !== 'missed');
  const core = daily.filter((q) => q.instance.core_snapshot);
  const coreOpen = open.filter((q) => q.instance.core_snapshot).length;
  const coreAllDone = core.length > 0 && core.every((q) => isDone(q.instance.status));
  // Only say something about core quests when there are some today (none on Day 1).
  const coreNote = coreOpen > 0 ? `${coreOpen} core open` : coreAllDone ? 'core done' : null;
  const nextQuest = next ? daily.find((q) => q.instance.id === next.instanceId) : undefined;
  const left =
    nextQuest &&
    nextQuest.instance.measure_snapshot === 'minutes' &&
    nextQuest.instance.target_snapshot
      ? `${Math.max(0, nextQuest.instance.target_snapshot - nextQuest.progress)} min left`
      : null;

  return (
    <section aria-label="Next" className="tile tile-lime flex flex-col gap-3 p-4">
      {/* The day's done count lives on the list heading just below — not repeated here. */}
      <span className="text-on-tile-muted text-xs font-bold tracking-widest uppercase">
        {next ? 'Next' : 'Today'}
      </span>

      {next ? (
        <div className="flex flex-col gap-1">
          <p className="display text-xl">{next.title}</p>
          <p className="text-on-tile-muted text-sm">{next.why}</p>
          {(left || coreNote) && (
            <p className="text-sm font-semibold">{[left, coreNote].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      ) : (
        <p className="display text-lg">
          {!daily.length
            ? 'A rest day.'
            : open.length === 0
              ? 'Everything is done for today.'
              : 'Nothing else to do right now.'}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {next?.focus && isEnabled('focus') && (
          <Link
            to="/focus"
            className="bg-on-tile-lime text-tile-lime inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold"
          >
            <Timer aria-hidden size={16} /> Start focus
          </Link>
        )}
        {daily.length > 0 && (
          <button
            type="button"
            onClick={onQuests}
            className="border-on-tile-lime/30 inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold"
          >
            {next ? 'See it in the list' : 'See today’s quests'}
          </button>
        )}
      </div>
    </section>
  );
}
