import { FollowUpsCard } from '@/features/jobs/FollowUpsCard';
import { AskEntry } from '@/features/ask/AskButton';
import { BatteryLow, Timer } from 'lucide-react';
import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import { useState } from 'react';
import { visibleOnLowEnergy } from '@/core/engine/dayEval';
import { isRecoveryId } from '@/core/engine/instances';
import { isDone } from '@/core/engine/progress';
import { useAppState } from '@/core/state/app';
import { useToday } from '@/core/state/today';
import { Button } from '@/ui/Button';
import { useAction } from '@/ui/hooks/useAction';
import { ScreenTimeToday } from '@/features/screentime/ScreenTimeCard';
import { BackupReminder } from './BackupReminder';
import { CheckInPrompt } from './CheckInPrompt';
import { MonthlyReviewPrompt, WeeklyReviewPrompt } from './WeeklyReviewPrompt';
import { QuestCard } from './QuestCard';
import { RecoveryCard } from './RecoveryCard';
import { StatusHeader } from './StatusHeader';
import { SuggestionSlot } from './SuggestionSlot';
import { useAdaptiveToday } from './useAdaptiveToday';
import { WhatNow } from './WhatNow';
import { ReminderSetupCard } from './ReminderSetupCard';
import { SyncPausedNote } from './SyncPausedNote';
import { SystemMessage } from './SystemMessage';
import { ThisWeek } from './ThisWeek';
import { WakeCard } from './WakeCard';
import { EmptyState } from '@/ui/EmptyState';
import { Chip } from '@/ui/Surface';
import { TodayTiles } from './TodayTiles';

type QuestFilter = 'all' | 'core' | 'body' | 'mind' | 'career';

/** Today's quest filter chips (Phase 12): Body = STR, Mind = WIL, Career = INT. */
const FILTERS: { id: QuestFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'core', label: 'Core' },
  { id: 'body', label: 'Body' },
  { id: 'mind', label: 'Mind' },
  { id: 'career', label: 'Career' },
];

function matchesFilter(
  i: { core_snapshot: boolean; stat_snapshot: string },
  f: QuestFilter,
): boolean {
  if (f === 'all') return true;
  if (f === 'core') return i.core_snapshot;
  return i.stat_snapshot === (f === 'body' ? 'STR' : f === 'mind' ? 'WIL' : 'INT');
}

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
  const { risks, next } = useAdaptiveToday();
  const notStarted = startDay !== null && day !== null && day < startDay;

  const recovery = other.filter((q) => isRecoveryId(q.instance.id));
  const wake = daily.filter((q) => q.instance.auto_source_snapshot === 'wake_checkin');
  const rest = daily.filter((q) => q.instance.auto_source_snapshot !== 'wake_checkin');
  const visible = (q: (typeof daily)[number]) =>
    !lowEnergy || showAll || visibleOnLowEnergy(q.instance);
  const hidden = daily.filter((q) => !visible(q)).length;
  const hasCore = daily.some((q) => q.instance.core_snapshot);
  const doneCount = daily.filter((q) => isDone(q.instance.status)).length;
  const [filter, setFilter] = useState<QuestFilter>('all');
  const shown = (q: (typeof daily)[number]) => visible(q) && matchesFilter(q.instance, filter);
  const scrollToQuests = () =>
    document
      .getElementById('quests-heading')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-accent-text text-xs font-bold tracking-widest uppercase">Today</h1>
            <AskEntry />
          </div>
          <StatusHeader day={day} />
        </div>
        <SystemMessage />
        <WhatNow next={next} />
        {status === 'ready' && !notStarted && <TodayTiles onQuests={scrollToQuests} />}
        <SuggestionSlot />
        {isEnabled('screenTime') && <ScreenTimeToday />}
        <ReminderSetupCard />
        <SyncPausedNote />
        <FollowUpsCard />
        <WeeklyReviewPrompt />
        <MonthlyReviewPrompt />
        <CheckInPrompt />
        <BackupReminder />
      </div>

      <section aria-labelledby="quests-heading" className="flex scroll-mt-6 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="quests-heading" className="display text-lg">
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
        {daily.length > 0 && (
          <div
            role="group"
            aria-label="Show quests"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {FILTERS.map((f) => (
              <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        )}
        {isEnabled('focus') && (
          <Link
            to="/focus"
            className="pill bg-surface-2 text-text inline-flex min-h-11 items-center gap-2 self-start px-4 text-sm font-semibold"
          >
            <Timer aria-hidden size={16} /> Start focus
          </Link>
        )}

        {status === 'ready' && notStarted && (
          <p className="panel p-4">
            Your first day starts tomorrow. Rest well — your quests will be here in the morning.
          </p>
        )}
        {status === 'ready' && !notStarted && daily.length === 0 && (
          <EmptyState>
            No daily quests today. Enjoy the rest day — it won’t affect your streak.
          </EmptyState>
        )}

        <ul className="flex flex-col gap-3">
          {wake.filter(shown).map((q) => (
            <WakeCard key={q.instance.id} quest={q} />
          ))}
          {recovery.map((q) => (
            <RecoveryCard key={q.instance.id} quest={q} />
          ))}
          {rest.filter(shown).map((q) => (
            <QuestCard
              key={q.instance.id}
              quest={q}
              lowEnergy={lowEnergy}
              risk={risks.get(q.instance.id)?.why}
            />
          ))}
        </ul>

        {lowEnergy && (hidden > 0 || showAll) && (
          <Button variant="ghost" className="self-center" onClick={() => setShowAll(!showAll)}>
            {showAll
              ? 'Hide non-core quests'
              : `Show ${hidden} hidden quest${hidden === 1 ? '' : 's'}`}
          </Button>
        )}
        <ThisWeek />
      </section>
    </div>
  );
}
