import { isDone } from '@/core/engine/progress';
import { useAppState } from '@/core/state/app';
import { useToday } from '@/core/state/today';
import { QuestCard } from './QuestCard';
import { StatusHeader } from './StatusHeader';
import { WakeCard } from './WakeCard';

/** Home screen (SPEC 7.2): status header + today's daily quests. */
export function TodayPage() {
  const { status, day, daily } = useToday((s) => s);
  const startDay = useAppState((s) => s.profile?.start_day ?? null);
  const notStarted = startDay !== null && day !== null && day < startDay;
  const wake = daily.filter((q) => q.instance.auto_source_snapshot === 'wake_checkin');
  const rest = daily.filter((q) => q.instance.auto_source_snapshot !== 'wake_checkin');
  const doneCount = daily.filter((q) => isDone(q.instance.status)).length;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <h1 className="text-xl font-semibold">Today</h1>
        <StatusHeader day={day} />
      </div>

      <section aria-labelledby="quests-heading" className="flex flex-col gap-3 lg:pt-14">
        <div className="flex items-baseline justify-between">
          <h2 id="quests-heading" className="text-lg font-semibold">
            Daily quests
          </h2>
          {daily.length > 0 && (
            <span className="text-muted text-sm tabular-nums">
              {doneCount} / {daily.length} done
            </span>
          )}
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
          {wake.map((q) => (
            <WakeCard key={q.instance.id} quest={q} />
          ))}
          {rest.map((q) => (
            <QuestCard key={q.instance.id} quest={q} />
          ))}
        </ul>
      </section>
    </div>
  );
}
