import { Check, HeartHandshake, Undo2 } from 'lucide-react';
import { isDone } from '@/core/engine/progress';
import { useProgress } from '@/core/state/progress';
import type { TodayQuest } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { StatChip } from '@/ui/stats';
import { XpFloat } from '@/ui/XpFloat';
import { useQuestAction } from './useQuestAction';

/**
 * The Recovery quest (SPEC 4.5): small and kind, one tap when done. It says honestly whether
 * it repairs the streak (DECISIONS 3) or is a fresh start.
 */
export function RecoveryCard({ quest }: { quest: TodayQuest }) {
  const { act, busy, error, float } = useQuestAction();
  const restores = useProgress((s) => s.progress?.streak.repairable?.streak ?? null);
  const streakNow = useProgress((s) => s.progress?.streak.streak ?? 0);
  const { instance } = quest;
  const done = isDone(instance.status);
  const repairs = quest.quest?.repairs_day != null;

  return (
    <li className="panel outline-accent relative flex flex-col gap-3 p-4 outline-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-accent-text flex items-center gap-1 text-xs font-semibold tracking-wide uppercase">
            <HeartHandshake aria-hidden size={14} />
            Recovery quest
          </p>
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 className="display">{instance.title_snapshot}</h3>
            <StatChip stat={instance.stat_snapshot} />
          </div>
          <p className="text-muted text-sm">{instance.full_version_snapshot}</p>
          <p className="text-sm">
            {repairs && !done && restores !== null && `Restores your ${restores}-day streak.`}
            {repairs && done && `Streak restored — ${streakNow} days and counting.`}
            {!repairs && 'Easy XP and a fresh start.'}
          </p>
        </div>
        {done && (
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-success-text flex items-center gap-1 text-sm font-medium">
              <Check aria-hidden size={16} className={float !== null ? 'animate-check-pop' : ''} />
              Done
            </span>
            <Button
              variant="ghost"
              className="px-2"
              aria-label="Undo Recovery quest"
              disabled={busy}
              onClick={() =>
                void act({ type: 'quest.untick', payload: { instanceId: instance.id } })
              }
            >
              <Undo2 aria-hidden size={18} />
            </Button>
          </div>
        )}
      </div>
      {instance.status === 'pending' && (
        <Button
          disabled={busy}
          onClick={() =>
            void act({
              type: 'quest.complete',
              payload: { instanceId: instance.id, version: 'full' },
            })
          }
        >
          Done
        </Button>
      )}
      {error && (
        <p role="alert" className="text-warning-text text-sm">
          {error}
        </p>
      )}
      <XpFloat float={float} />
    </li>
  );
}
