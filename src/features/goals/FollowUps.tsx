import { AlertTriangle, HeartHandshake } from 'lucide-react';
import { addDays } from '@/core/time';
import { useGoals } from '@/core/state/goals';
import { useToday } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { recordAnswer, useShown } from '@/ui/hooks/useShown';
import { useNudges } from './useNudges';

/** Deadline-risk options (SPEC 6.3): extend, add time, or reduce scope — each one tap. */
function RiskCard({
  mainQuestId,
  milestoneId,
  message,
  onReplan,
}: {
  mainQuestId: string;
  milestoneId: string | null;
  message: string;
  onReplan: () => void;
}) {
  const quest = useGoals((s) => s.mainQuests.find((q) => q.id === mainQuestId));
  const milestone = useGoals((s) => s.milestones.find((m) => m.id === milestoneId));
  const today = useToday((s) => s.day);
  const { run, busy, error } = useAction();
  useShown(quest && today ? 'goal_risk' : null, milestoneId ?? mainQuestId);
  if (!quest || !today) return null;
  const answer = () => recordAnswer('goal_risk', milestoneId ?? mainQuestId, 'accepted');

  const extend = async () => {
    answer();
    if (milestone?.target_date) {
      const date = addDays(milestone.target_date > today ? milestone.target_date : today, 14);
      const ok = await run({
        type: 'milestone.update',
        payload: { id: milestone.id, changes: { target_date: date } },
      });
      if (ok && quest.target_date && quest.target_date < date) {
        await run({
          type: 'mainQuest.update',
          payload: { id: quest.id, changes: { target_date: date } },
        });
      }
    } else {
      await run({
        type: 'mainQuest.update',
        payload: { id: quest.id, changes: { target_date: addDays(today, 28) } },
      });
    }
  };
  const addTime = () => {
    answer();
    return run({
      type: 'quest.create',
      payload: {
        type: 'weekly',
        title: `Extra session toward “${milestone?.title ?? quest.title}”`,
        stat: quest.stat,
        linked_goal_type: milestone ? 'milestone' : 'main_quest',
        linked_goal_id: milestone?.id ?? quest.id,
        planned_by: 'rules',
      },
    });
  };
  const smaller =
    milestone?.target_type === 'count' && milestone.target_value
      ? { target_value: Math.max(1, Math.ceil(milestone.target_value * 0.75)) }
      : milestone?.target_type === 'manual' && milestone.estimated_weekly_quests
        ? {
            estimated_weekly_quests: Math.max(
              1,
              Math.ceil(milestone.estimated_weekly_quests * 0.75),
            ),
          }
        : null;

  return (
    <section
      aria-label="Deadline at risk"
      className="border-warning bg-surface flex flex-col gap-3 rounded-lg border p-4"
    >
      <p className="flex items-start gap-2">
        <AlertTriangle aria-hidden size={18} className="text-warning-text mt-0.5 shrink-0" />
        {message}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void extend()}>
          {milestone ? 'Give it 2 more weeks' : 'Move the deadline 4 weeks'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => void addTime()}>
          Add one session this week
        </Button>
        {smaller && milestone ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              answer();
              void run({
                type: 'milestone.update',
                payload: { id: milestone.id, changes: smaller },
              });
            }}
          >
            Make it smaller
          </Button>
        ) : (
          <Button variant="secondary" disabled={busy} onClick={onReplan}>
            Re-plan
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

/** The ~30-day check-in (SPEC 6.3): one question, three answers. */
function CheckInCard({
  mainQuestId,
  message,
  onReplan,
}: {
  mainQuestId: string;
  message: string;
  onReplan: () => void;
}) {
  const today = useToday((s) => s.day);
  const { run, busy, error } = useAction();
  useShown(today ? 'goal_checkin' : null, mainQuestId);
  if (!today) return null;
  return (
    <section
      aria-label="Check-in"
      className="border-border bg-surface-2 flex flex-col gap-3 rounded-lg border p-4"
    >
      <p className="flex items-start gap-2">
        <HeartHandshake aria-hidden size={18} className="text-accent-text mt-0.5 shrink-0" />
        {message}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            void run({ type: 'mainQuest.checkIn', payload: { id: mainQuestId, day: today } })
          }
        >
          Yes, keep going
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run({ type: 'mainQuest.checkIn', payload: { id: mainQuestId, day: today } }).then(
              onReplan,
            )
          }
        >
          Yes, but re-plan
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run({
              type: 'mainQuest.setStatus',
              payload: { id: mainQuestId, status: 'paused' },
            })
          }
        >
          Pause it
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

/** Follow-up cards for one main quest. */
export function FollowUps({
  mainQuestId,
  onReplan,
}: {
  mainQuestId: string;
  onReplan: () => void;
}) {
  const nudges = useNudges().filter((n) => n.mainQuestId === mainQuestId);
  return (
    <>
      {nudges.map((n) =>
        n.kind === 'risk' ? (
          <RiskCard
            key={`r-${n.milestoneId ?? 'q'}`}
            mainQuestId={mainQuestId}
            milestoneId={n.milestoneId}
            message={n.message}
            onReplan={onReplan}
          />
        ) : (
          <CheckInCard key="c" mainQuestId={mainQuestId} message={n.message} onReplan={onReplan} />
        ),
      )}
    </>
  );
}
