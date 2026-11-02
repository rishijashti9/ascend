import { useReviews } from '@/core/state/reviews';
import { useToday } from '@/core/state/today';
import { formatDay } from '@/features/goals/format';
import { DailyCheckIn } from './DailyCheckIn';

/** Review (SPEC 7.7): the daily check-in and past check-ins. Weekly and monthly come next. */
export function ReviewPage() {
  const reviews = useReviews((s) => s.reviews);
  const day = useToday((s) => s.day);
  if (!day) return null;
  const daily = reviews.filter((r) => r.type === 'daily');
  const today = daily.find((r) => r.period === day);
  const past = daily.filter((r) => r.period !== day).slice(0, 14);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Review</h1>
      <DailyCheckIn key={day} day={day} existing={today} />
      {past.length > 0 && (
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
