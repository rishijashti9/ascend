import { History, Undo2 } from 'lucide-react';
import type { PlanChange, PlanHistory as HistoryRow } from '@/core/db/types';
import { useGoals } from '@/core/state/goals';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';

const ENTITY: Record<string, string> = {
  milestones: 'Milestone',
  quests: 'Weekly quest',
  habits: 'Daily quest',
  main_quests: 'Main quest',
  dreams: 'Dream',
};

function titleOf(c: PlanChange): string {
  const rec = (c.after ?? c.before) as { title?: unknown } | null;
  return typeof rec?.title === 'string' ? rec.title : '';
}

/** "Added: Milestone “IELTS 7.5”" — instance rows are internal and not listed. */
function changeLines(changes: readonly PlanChange[]): string[] {
  return changes
    .filter((c) => ENTITY[c.entity])
    .map((c) => `${c.before === null ? 'Added' : 'Changed'}: ${ENTITY[c.entity]} “${titleOf(c)}”`);
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Entry({ entry }: { entry: HistoryRow }) {
  const { run, busy, error } = useAction();
  const lines = changeLines(entry.changes);
  return (
    <li className="inset flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{entry.summary}</p>
          <p className="text-muted text-xs">
            {when(entry.created_at)} · {entry.source === 'ai' ? 'AI coach' : 'planned by System'}
            {entry.undone_at && ' · undone'}
          </p>
        </div>
        {!entry.undone_at && (
          <Button
            variant="ghost"
            className="shrink-0 px-2"
            disabled={busy}
            onClick={() => void run({ type: 'plan.undo', payload: { id: entry.id } })}
          >
            <Undo2 aria-hidden size={18} /> Undo
          </Button>
        )}
      </div>
      {lines.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted min-h-11 cursor-pointer py-2">
            {lines.length} change{lines.length === 1 ? '' : 's'}
          </summary>
          <ul className="text-muted flex flex-col gap-1 pb-1">
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </details>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </li>
  );
}

/** Plan history (SPEC 6.3): what the System changed, why, when — each with Undo. */
export function PlanHistoryList({ goalId, limit }: { goalId?: string; limit?: number }) {
  const history = useGoals((s) => s.history);
  const rows = (goalId ? history.filter((h) => h.goal_id === goalId) : history).slice(0, limit);
  if (rows.length === 0) return null;
  return (
    <section aria-label="Plan history" className="flex flex-col gap-2">
      <h2 className="display flex items-center gap-2 text-lg">
        <History aria-hidden size={18} /> Plan history
      </h2>
      <ul className="flex flex-col gap-2">
        {rows.map((h) => (
          <Entry key={h.id} entry={h} />
        ))}
      </ul>
    </section>
  );
}
