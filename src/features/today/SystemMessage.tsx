import { welcomeBack } from '@/app/rollover';
import { evaluateDay } from '@/core/engine/dayEval';
import { isRecoveryId } from '@/core/engine/instances';
import { systemMessage } from '@/core/engine/messages';
import { isDone } from '@/core/engine/progress';
import { useAppState } from '@/core/state/app';
import { useProgress } from '@/core/state/progress';
import { useToday } from '@/core/state/today';
import { currentTimeZone, dayNumber, localParts } from '@/core/time';
import { useNow } from '@/ui/hooks/useNow';
import { Robot } from '@/ui/Robot';

/** One calm line from the System (rule templates in engine/messages.ts). */
export function SystemMessage() {
  const progress = useProgress((s) => s.progress);
  const startDay = useAppState((s) => s.profile?.start_day ?? null);
  const { day, daily, other, lowEnergy } = useToday((s) => s);
  const now = useNow(60_000);
  if (!progress || !day) return null;

  const instances = daily.map((q) => q.instance);
  const core = instances.filter((i) => i.core_snapshot);
  const recovery = other.find((q) => isRecoveryId(q.instance.id));
  const text = systemMessage({
    dayN: startDay && day >= startDay ? dayNumber(startDay, day) : null,
    hour: localParts(now, currentTimeZone()).hour,
    streak: progress.streak.streak,
    streakAtStart: progress.today.streakAtStart,
    coreTotal: core.length,
    coreDone: core.filter((i) => isDone(i.status)).length,
    dailyTotal: instances.length,
    dailyDone: instances.filter((i) => isDone(i.status)).length,
    dailyClear: evaluateDay(instances, lowEnergy).dailyClear,
    lowEnergy,
    welcome: welcomeBack(day),
    recovery: recovery
      ? {
          done: isDone(recovery.instance.status),
          restores:
            recovery.quest?.repairs_day != null
              ? (progress.streak.repairable?.streak ?? progress.today.streakAtStart)
              : null,
        }
      : null,
  });

  return (
    <p role="status" className="inset text-text flex items-center gap-3 px-3 py-2.5 text-sm">
      <Robot size={36} mood={evaluateDay(instances, lowEnergy).dailyClear ? 'happy' : 'idle'} />
      <span>
        <span className="text-accent-text block text-xs font-semibold tracking-wide uppercase">
          System
        </span>
        {text}
      </span>
    </p>
  );
}
