import { CalendarCheck } from 'lucide-react';
import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import { useAppState } from '@/core/state/app';
import { useReviews } from '@/core/state/reviews';
import { useToday } from '@/core/state/today';
import { periodOf, periodRange } from '@/core/engine/periodStats';
import { addDays, weekStartOf } from '@/core/time';
import { periodLabel } from '@/features/review/format';
import { ArrowCircle } from '@/ui/Surface';

/** On the week's last day: a nudge for the weekly review, until it's saved (SPEC 4.5). */
export function WeeklyReviewPrompt() {
  const day = useToday((s) => s.day);
  const weekStartsOn = useAppState((s) => s.settings?.week_start ?? 1);
  const reviews = useReviews((s) => s.reviews);
  if (!isEnabled('review') || !day) return null;
  const weekStart = weekStartOf(day, weekStartsOn);
  const lastDay = addDays(weekStart, 6) === day;
  const done = reviews.some((r) => r.type === 'weekly' && r.period === weekStart);
  if (!lastDay || done) return null;
  return (
    <Link
      to="/me/reviews?tab=weekly"
      className="tile tile-white flex min-h-11 items-center gap-3 p-4 text-sm font-semibold transition-transform duration-(--dur) active:scale-[0.98]"
    >
      <CalendarCheck aria-hidden size={20} className="shrink-0" />
      <span className="flex-1">Weekly review — 5 minutes to look back and plan next week.</span>
      <ArrowCircle />
    </Link>
  );
}

/**
 * On a month's last day: its summary is ready (on 31 Dec, the year's instead), until a
 * reflection is saved for it. The stats are always there; this is just the nudge.
 */
export function MonthlyReviewPrompt() {
  const day = useToday((s) => s.day);
  const reviews = useReviews((s) => s.reviews);
  if (!isEnabled('review') || !day) return null;
  const type = periodRange('yearly', periodOf('yearly', day)).to === day ? 'yearly' : 'monthly';
  const period = periodOf(type, day);
  const lastDay = periodRange(type, period).to === day;
  const done = reviews.some((r) => r.type === type && r.period === period);
  if (!lastDay || done) return null;
  return (
    <Link
      to={`/me/reviews?tab=${type}`}
      className="tile tile-white flex min-h-11 items-center gap-3 p-4 text-sm font-semibold transition-transform duration-(--dur) active:scale-[0.98]"
    >
      <CalendarCheck aria-hidden size={20} className="shrink-0" />
      <span className="flex-1">
        Your {periodLabel(type, period)} summary is ready — take a look back.
      </span>
      <ArrowCircle />
    </Link>
  );
}
