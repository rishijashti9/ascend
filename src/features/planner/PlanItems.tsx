import type { ProposalItem } from '@/core/planner';
import { GROUP_TITLE, groupOf, itemLabel, type Group } from './itemText';

/** A plan's items grouped as added / changed / removed, each with its reason (read-only). */
export function PlanItems({ items }: { items: readonly ProposalItem[] }) {
  if (items.length === 0)
    return <p className="text-muted text-sm">Nothing to change — this goal is already planned.</p>;
  return (
    <div className="flex flex-col gap-4">
      {(['added', 'changed', 'removed'] as Group[]).map((g) => {
        const list = items.filter((i) => groupOf(i) === g);
        if (list.length === 0) return null;
        return (
          <section key={g} aria-label={GROUP_TITLE[g]} className="flex flex-col gap-2">
            <h3 className="display text-muted text-sm">{GROUP_TITLE[g]}</h3>
            <ul className="flex flex-col gap-2">
              {list.map((i) => (
                <li key={i.id} className="border-border bg-surface rounded-md border p-3">
                  <p className="font-medium">{itemLabel(i)}</p>
                  <p className="text-muted text-sm">{i.reason}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
