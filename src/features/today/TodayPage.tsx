import { BatteryLow } from 'lucide-react';
import { useState } from 'react';
import { visibleOnLowEnergy } from '@/core/engine/dayEval';
import { isRecoveryId } from '@/core/engine/instances';
import { isDone } from '@/core/engine/progress';
import { useAppState } from '@/core/state/app';
import { useToday } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { BackupReminder } from './BackupReminder';
import { QuestCard } from './QuestCard';
import { RecoveryCard } from './RecoveryCard';
import { StatusHeader } from './StatusHeader';
import { SystemMessage } from './SystemMessage';
import { WakeCard } from './WakeCard';

/** Low-energy mode (SPEC 4.8): today only, on and off any time before the day closes. */
function LowEnergyToggle({ on }: { on: boolean }) {
  const { run, busy } = useAction();
  return (
    <Button
      variant={on ? 'secondary' : 'ghost'}
      aria-pressed={on}
      disabled={busy}
      className="px-3 text-sm"
      onClick={() => void run({ type: 'day.setLowEnergy', payload: { on: !on } })}
    >
      <BatteryLow aria-hidden size={18} />
      Low energy{on ? ': on' : ''}
    </Button>
  );
}

/** Home screen (SPEC 7.2): status, one System message, Recovery quest and daily quests. */
export function TodayPage() {
  const { status, day, daily, other, lowEnergy } = useToday((s) => s);
  const startDay = useAppState((s) => s.profile?.start_day ?? null);
  const [showAll, setShowAll] = useState(false);
  const notStarted = startDay !== null && day !== null && day < startDay;

  const recovery = other.filter((q) => isRecoveryId(q.instance.id));
  const wake = daily.filter((q) => q.instance.auto_source_snapshot === 'wake_checkin');
  const rest = daily.filter((q) => q.instance.auto_source_snapshot !== 'wake_checkin');
  const visible = (q: (typeof daily)[number]) =>
    !lowEnergy || showAll || visibleOnLowEnergy(q.instance);
  const hidden = daily.filter((q) => !visible(q)).length;
  const hasCore = daily.some((q) => q.instance.core_snapshot);
  const doneCount = daily.filter((q) => isDone(q.instance.status)).length;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <h1 className="text-xl font-semibold">Today</h1>
        <StatusHeader day={day} />
        <SystemMessage />
        <BackupReminder />
      </div>

      <section aria-labelledby="quests-heading" className="flex flex-col gap-3 lg:pt-14">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="quests-heading" className="text-lg font-semibold">
            Daily quests
            {daily.length > 0 && (
              <span className="text-muted ml-2 text-sm font-normal tabular-nums">
                {doneCount} / {daily.length} done
              </span>
            )}
          </h2>
          {/* Low energy means "core minimums only" — meaningless on a day without core quests. */}
          {status === 'ready' && (hasCore || lowEnergy) && <LowEnergyToggle on={lowEnergy} />}
        </div>

        {status === 'ready' && notStarted && (
          <p className="border-border bg-surface rounded-lg border p-4">
            Your first day starts tomorrow. Rest well — your quests will be here in the morning.
          </p>
        )}
        {status === 'ready' && !notStarted && daily.length === 0 && (
          <p className="border-border bg-surface rounded-lg border p-4">
            No daily quests today. Enjoy the rest day — it won’t affect your streak.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {wake.filter(visible).map((q) => (
            <WakeCard key={q.instance.id} quest={q} />
          ))}
          {recovery.map((q) => (
            <RecoveryCard key={q.instance.id} quest={q} />
          ))}
          {rest.filter(visible).map((q) => (
            <QuestCard key={q.instance.id} quest={q} lowEnergy={lowEnergy} />
          ))}
        </ul>

        {lowEnergy && (hidden > 0 || showAll) && (
          <Button variant="ghost" className="self-center" onClick={() => setShowAll(!showAll)}>
            {showAll
              ? 'Hide non-core quests'
              : `Show ${hidden} hidden quest${hidden === 1 ? '' : 's'}`}
          </Button>
        )}
      </section>
    </div>
  );
}
