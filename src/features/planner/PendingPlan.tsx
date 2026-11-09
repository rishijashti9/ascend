import { Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { PlanProposal } from '@/core/db/types';
import type { ProposalItem } from '@/core/planner';
import { useGoals } from '@/core/state/goals';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { useShown } from '@/ui/hooks/useShown';
import { planSuggestionType } from '@/core/adaptive/record';
import { GROUP_TITLE, groupOf, itemLabel, type Group } from './itemText';

type Edit = { title?: string; target_value?: number };

function editableTitle(item: ProposalItem): string | null {
  return item.kind === 'milestone.create' ||
    item.kind === 'quest.create' ||
    item.kind === 'habit.create'
    ? item.data.title
    : null;
}

/** The item as it will be saved with an edited title. */
function withTitle(item: ProposalItem, title: string): ProposalItem {
  if (item.kind === 'milestone.create') return { ...item, data: { ...item.data, title } };
  if (item.kind === 'quest.create') return { ...item, data: { ...item.data, title } };
  if (item.kind === 'habit.create') return { ...item, data: { ...item.data, title } };
  return item;
}

function ItemRow({
  item,
  checked,
  edit,
  onToggle,
  onEdit,
}: {
  item: ProposalItem;
  checked: boolean;
  edit: Edit;
  onToggle: () => void;
  onEdit: (e: Edit) => void;
}) {
  const [editing, setEditing] = useState(false);
  const title = editableTitle(item);
  const minutes =
    item.kind === 'habit.create' && item.data.measure === 'minutes' ? item.data.target_value : null;
  const shown = itemLabel(edit.title ? withTitle(item, edit.title) : item);

  return (
    <li className={`inset flex flex-col gap-2 p-3 ${checked ? '' : 'opacity-60'}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={`Include: ${shown}`}
          onClick={onToggle}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 ${
            checked ? 'bg-accent-fill text-on-accent border-transparent' : 'border-muted'
          }`}
        >
          {checked && <Check aria-hidden size={20} />}
        </button>
        <div className="min-w-0 flex-1 pt-1">
          <p className="font-medium">{shown}</p>
          <p className="text-muted text-sm">
            {item.reason}
            {minutes !== null &&
              edit.target_value !== undefined &&
              ` Now ${edit.target_value} min.`}
          </p>
        </div>
        {title !== null && (
          <Button
            variant="ghost"
            className="px-2 text-sm"
            onClick={() => setEditing(!editing)}
            aria-expanded={editing}
          >
            Edit
          </Button>
        )}
      </div>
      {editing && title !== null && (
        <div className="flex flex-wrap gap-2 pl-14">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            Title
            <input
              value={edit.title ?? title}
              maxLength={160}
              onChange={(e) => onEdit({ ...edit, title: e.target.value })}
              className="control min-h-11 px-3 text-base"
            />
          </label>
          {minutes !== null && (
            <label className="flex w-32 flex-col gap-1 text-sm">
              Minutes a day
              <input
                type="number"
                min={5}
                value={edit.target_value ?? minutes}
                onChange={(e) =>
                  onEdit({ ...edit, target_value: Number(e.target.value) || undefined })
                }
                className="control min-h-11 px-3 text-base"
              />
            </label>
          )}
        </div>
      )}
    </li>
  );
}

/** Impact preview (SPEC 6.3 step 4): see every change with its reason, edit any item, approve. */
export function ImpactPreview({
  proposal,
  onDone,
}: {
  proposal: PlanProposal;
  onDone?: () => void;
}) {
  const items = proposal.items as ProposalItem[];
  const [selected, setSelected] = useState(
    () => new Set(items.filter((i) => i.selected).map((i) => i.id)),
  );
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const { run, busy, error } = useAction();
  useShown(planSuggestionType(proposal.trigger), proposal.id);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const cleanEdits = Object.fromEntries(
    Object.entries(edits)
      .filter(([id]) => selected.has(id))
      .map(([id, e]) => [
        id,
        {
          ...(e.title?.trim() ? { title: e.title.trim() } : {}),
          ...(e.target_value ? { target_value: e.target_value } : {}),
        },
      ]),
  );

  return (
    <section
      aria-label="Plan waiting for review"
      className="panel outline-accent outline-2 flex flex-col gap-4 p-4"
    >
      <h2 className="display flex items-center gap-2">
        <Sparkles aria-hidden size={18} className="text-accent-text" /> Plan waiting for review
      </h2>
      <p className="text-sm">{proposal.summary}</p>
      {(['added', 'changed', 'removed'] as Group[]).map((g) => {
        const list = items.filter((i) => groupOf(i) === g);
        if (list.length === 0) return null;
        return (
          <section key={g} aria-label={GROUP_TITLE[g]} className="flex flex-col gap-2">
            <h3 className="display text-muted text-sm">{GROUP_TITLE[g]}</h3>
            <ul className="flex flex-col gap-2">
              {list.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  checked={selected.has(i.id)}
                  edit={edits[i.id] ?? {}}
                  onToggle={() => toggle(i.id)}
                  onEdit={(e) => setEdits({ ...edits, [i.id]: e })}
                />
              ))}
            </ul>
          </section>
        );
      })}
      <p className="text-muted text-xs">
        Everything stays editable afterwards, and the whole plan can be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || selected.size === 0}
          onClick={() =>
            void run({
              type: 'plan.apply',
              payload: { id: proposal.id, selected: [...selected], edits: cleanEdits },
            }).then((ok) => ok && onDone?.())
          }
        >
          {selected.size === items.length
            ? 'Approve all'
            : `Approve ${selected.size} of ${items.length}`}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run({ type: 'plan.reject', payload: { id: proposal.id } }).then(
              (ok) => ok && onDone?.(),
            )
          }
        >
          Not now
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

/** The waiting plan for a goal, if any. */
export function PendingPlan({ goalId }: { goalId: string }) {
  const proposal = useGoals((s) => s.proposals.find((p) => p.goal_id === goalId));
  if (!proposal) return null;
  return <ImpactPreview key={proposal.id} proposal={proposal} />;
}
