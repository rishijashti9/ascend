import { useSearchParams } from 'react-router';
import { useAppState } from '@/core/state/app';
import { useReviews } from '@/core/state/reviews';
import { useToday } from '@/core/state/today';
import { formatDay } from '@/features/goals/format';
import { weekStartOf } from '@/core/time';
import { DailyCheckIn } from './DailyCheckIn';
import { WeeklyReview } from './WeeklyReview';

const TABS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
] as const;

/** Review (SPEC 7.7): the daily check-in and the weekly review. */
export function ReviewPage() {
  const reviews = useReviews((s) => s.reviews);
  const day = useToday((s) => s.day);
  const weekStartsOn = useAppState((s) => s.settings?.week_start ?? 1);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'weekly' ? 'weekly' : 'daily';
  if (!day) return null;
  const daily = reviews.filter((r) => r.type === 'daily');
  const today = daily.find((r) => r.period === day);
  const past = daily.filter((r) => r.period !== day).slice(0, 14);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Review</h1>
      <div
        role="tablist"
        aria-label="Review type"
        className="bg-surface-2 flex gap-1 rounded-md p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === 'daily' ? {} : { tab: t.id }, { replace: true })}
            className={`min-h-11 flex-1 rounded-md text-sm font-medium ${
              tab === t.id ? 'bg-surface text-text shadow-card' : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'weekly' ? (
        <WeeklyReview
          key={weekStartOf(day, weekStartsOn)}
          weekStart={weekStartOf(day, weekStartsOn)}
          today={day}
        />
      ) : (
        <DailyCheckIn key={day} day={day} existing={today} />
      )}
      {tab === 'daily' && past.length > 0 && (
        <section aria-label="Past check-ins" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Past check-ins</h2>
          <ul className="flex flex-col gap-2">
            {past.map((r) => (
              <li key={r.id} className="border-border bg-surface rounded-lg border p-3 text-sm">
                <p className="flex flex-wrap gap-x-3">
                  <span className="font-medium">{formatDay(r.period)}</span>
                  {r.energy !== null && (
                    <span className="text-muted tabular-nums">Energy {r.energy}/5</span>
                  )}
                  {r.mood !== null && (
                    <span className="text-muted tabular-nums">Mood {r.mood}/5</span>
                  )}
                </p>
                {r.win && (
                  <p className="mt-1">
                    <span className="text-muted">Win:</span> {r.win}
                  </p>
                )}
                {r.lesson && (
                  <p>
                    <span className="text-muted">Lesson:</span> {r.lesson}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
