import { CalendarCheck } from 'lucide-react';
import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import { useAppState } from '@/core/state/app';
import { useReviews } from '@/core/state/reviews';
import { useToday } from '@/core/state/today';
import { periodOf, periodRange } from '@/core/engine/periodStats';
import { addDays, weekStartOf } from '@/core/time';
import { periodLabel } from '@/features/review/format';

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
      to="/review?tab=weekly"
      className="panel flex min-h-11 items-center gap-2 px-4 py-3 text-sm"
    >
      <CalendarCheck aria-hidden size={18} className="text-accent-text shrink-0" />
      <span className="flex-1">Weekly review — 5 minutes to look back and plan next week.</span>
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
      to={`/review?tab=${type}`}
      className="panel flex min-h-11 items-center gap-2 px-4 py-3 text-sm"
    >
      <CalendarCheck aria-hidden size={18} className="text-accent-text shrink-0" />
      <span className="flex-1">
        Your {periodLabel(type, period)} summary is ready — take a look back.
      </span>
    </Link>
  );
}
