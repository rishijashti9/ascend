import { CalendarCheck } from 'lucide-react';
import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import { useAppState } from '@/core/state/app';
import { useReviews } from '@/core/state/reviews';
import { useToday } from '@/core/state/today';
import { addDays, weekStartOf } from '@/core/time';

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
      className="border-border bg-surface flex min-h-11 items-center gap-2 rounded-lg border px-4 py-3 text-sm"
    >
      <CalendarCheck aria-hidden size={18} className="text-accent-text shrink-0" />
      <span className="flex-1">Weekly review — 5 minutes to look back and plan next week.</span>
    </Link>
  );
}
