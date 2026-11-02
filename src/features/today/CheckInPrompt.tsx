import { NotebookPen } from 'lucide-react';
import { Link } from 'react-router';
import { isEnabled } from '@/config/features';
import { useAppState } from '@/core/state/app';
import { useReviews } from '@/core/state/reviews';
import { useToday } from '@/core/state/today';
import { currentTimeZone, localParts } from '@/core/time';
import { useNow } from '@/ui/hooks/useNow';

/** From 6 PM, a gentle nudge for the 1-minute check-in until it's done (SPEC 7.7). */
export function CheckInPrompt() {
  const day = useToday((s) => s.day);
  const done = useReviews((s) => s.reviews.some((r) => r.type === 'daily' && r.period === day));
  const dayStart = useAppState((s) => s.settings?.day_start_hour ?? 3);
  const now = useNow(60_000);
  const hour = localParts(now, currentTimeZone()).hour;
  // Evening of the app day: 18:00 until the day-start hour (after midnight still counts).
  const evening = hour >= 18 || hour < dayStart;
  if (!isEnabled('review') || !day || done || !evening) return null;
  return (
    <Link
      to="/review"
      className="border-border bg-surface flex min-h-11 items-center gap-2 rounded-lg border px-4 py-3 text-sm"
    >
      <NotebookPen aria-hidden size={18} className="text-accent-text shrink-0" />
      <span className="flex-1">How did today go? Take the 1-minute check-in.</span>
    </Link>
  );
}
