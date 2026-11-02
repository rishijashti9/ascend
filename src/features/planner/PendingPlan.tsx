import { Sparkles } from 'lucide-react';
import type { ProposalItem } from '@/core/planner';
import { useGoals } from '@/core/state/goals';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { PlanItems } from './PlanItems';

/** A planner proposal waiting for review on its goal's page. */
export function PendingPlan({ goalId }: { goalId: string }) {
  const proposal = useGoals((s) => s.proposals.find((p) => p.goal_id === goalId));
  const { run, busy, error } = useAction();
  if (!proposal) return null;
  return (
    <section
      aria-label="Plan waiting for review"
      className="border-accent bg-surface shadow-card flex flex-col gap-3 rounded-lg border p-4"
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles aria-hidden size={18} className="text-accent-text" /> Plan waiting for review
      </h2>
      <p className="text-sm">{proposal.summary}</p>
      <PlanItems items={proposal.items as ProposalItem[]} />
      <Button
        variant="secondary"
        className="self-start"
        disabled={busy}
        onClick={() => void run({ type: 'plan.reject', payload: { id: proposal.id } })}
      >
        Not now
      </Button>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
