import { Sunrise, Undo2 } from 'lucide-react';
import { wakeStatusAt } from '@/core/engine/wake';
import { useAppState } from '@/core/state/app';
import type { TodayQuest } from '@/core/state/today';
import { currentTimeZone, instantAt } from '@/core/time';
import { addMinutes, formatTime } from '@/data/starter';
import { Button } from '@/ui/Button';
import { useNow } from '@/ui/hooks/useNow';
import { StatChip } from '@/ui/stats';
import { XpFloat } from '@/ui/XpFloat';
import { StatusLine } from './QuestCard';
import { useQuestAction } from './useQuestAction';

/**
 * The wake-up quest, at the top of Today (SPEC 4.8): one "I'm up" tap. On time until wake
 * time + window (early taps too), late until the cutoff; after that it's gone for the day.
 */
export function WakeCard({ quest }: { quest: TodayQuest }) {
  const settings = useAppState((s) => s.settings);
  const now = useNow();
  const { act: run, busy, error, float } = useQuestAction();
  const { instance } = quest;
  if (!settings) return null;

  const pending = instance.status === 'pending';
  const phase = wakeStatusAt(now, instance.day, settings, currentTimeZone());
  const onTimeUntil = formatTime(addMinutes(settings.wake_time, settings.wake_window_min));
  const lateUntil = formatTime(settings.wake_late_cutoff);
  const beforeWake = now < instantAt(instance.day, settings.wake_time, currentTimeZone());

  return (
    <li className="panel relative flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 className="font-medium">{instance.title_snapshot}</h3>
            <StatChip stat={instance.stat_snapshot} />
          </div>
          <p className="text-muted text-sm">
            {pending && phase === 'done_full' && `On time until ${onTimeUntil}`}
            {pending && phase === 'done_late' && `Late check-in until ${lateUntil} — still counts`}
            {pending && phase === 'missed' && 'The wake-up window has closed for today.'}
            {!pending && instance.full_version_snapshot}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusLine status={instance.status} pop={float !== null} />
          {!pending && instance.status !== 'missed' && (
            <Button
              variant="ghost"
              className="px-2"
              aria-label="Undo wake-up check-in"
              disabled={busy}
              onClick={() =>
                void run({ type: 'quest.untick', payload: { instanceId: instance.id } })
              }
            >
              <Undo2 aria-hidden size={18} />
            </Button>
          )}
        </div>
      </div>
      {pending && phase !== 'missed' && (
        <Button
          className="w-full"
          disabled={busy}
          onClick={() =>
            void run({ type: 'quest.wakeCheckin', payload: { instanceId: instance.id } })
          }
        >
          <Sunrise aria-hidden size={20} />
          I’m up{beforeWake ? ' (early)' : ''}
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
