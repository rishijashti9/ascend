import type { InstanceStatus, Measure, ProgressEntry } from '@/core/db/types';

/**
 * Quest progress from separate progress entries (pure) — SPEC 4.8 "Measurable quests".
 * - minutes / count: entries add up (focus on the laptop + manual on the phone both count).
 * - steps / sleep_hours: entries are day TOTALS. The latest manual entry wins (a manual edit
 *   always wins); otherwise the latest Health Connect reading.
 */
export function progressValue(
  measure: Measure,
  entries: (Pick<ProgressEntry, 'source' | 'amount' | 'occurred_at' | 'deleted_at'> & {
    hlc?: string;
  })[],
): number {
  const live = entries.filter((e) => e.deleted_at === null);
  if (measure === 'minutes' || measure === 'count') {
    return Math.max(
      0,
      live.reduce((sum, e) => sum + e.amount, 0),
    );
  }
  if (measure === 'steps' || measure === 'sleep_hours') {
    const latest = (source: (s: string) => boolean) =>
      live
        .filter((e) => source(e.source))
        // Same moment (e.g. two readings for yesterday): the later write wins.
        .sort(
          (a, b) =>
            a.occurred_at.localeCompare(b.occurred_at) || (a.hlc ?? '').localeCompare(b.hlc ?? ''),
        )
        .at(-1)?.amount;
    return latest((s) => s !== 'health_connect') ?? latest((s) => s === 'health_connect') ?? 0;
  }
  return 0; // check quests have no numeric progress
}

/** Status reached by a numeric value: full at the target, minimum at the minimum. */
export function statusForValue(
  value: number,
  target: number | null,
  min: number | null,
): InstanceStatus {
  if (target !== null && value >= target) return 'done_full';
  if (min !== null && value >= min) return 'done_min';
  return 'pending';
}

const RANK: Record<InstanceStatus, number> = {
  pending: 0,
  missed: 0,
  skipped: 0,
  done_late: 1,
  done_min: 1,
  done_full: 2,
};

/** Progress only goes up during a day: never auto-downgrade a status. */
export function higherStatus(current: InstanceStatus, next: InstanceStatus): InstanceStatus {
  return RANK[next] > RANK[current] ? next : current;
}

export function isDone(status: InstanceStatus): boolean {
  return status === 'done_full' || status === 'done_min' || status === 'done_late';
}
