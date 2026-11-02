import type { PeriodType } from '@/core/engine/periodStats';

/** "November 2026" / "2026". */
export function periodLabel(type: PeriodType, period: string): string {
  if (type === 'yearly') return period;
  return new Date(`${period}-15T12:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
