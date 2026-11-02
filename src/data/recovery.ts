import type { DayString, Stat } from '@/core/db/types';
import { diffDays } from '@/core/time';

/**
 * Recovery quests (SPEC 4.5): small, kind, doable in 10 minutes. One is picked per day
 * (rotating, so it isn't always the same). Add more here any time.
 */
export interface RecoveryTemplate {
  title: string;
  stat: Stat;
  /** What to do, shown on the card. */
  task: string;
}

const WALK: RecoveryTemplate = {
  title: 'Recovery: easy walk',
  stat: 'STR',
  task: '10-minute walk, no phone',
};

export const RECOVERY_QUESTS: readonly RecoveryTemplate[] = [
  WALK,
  { title: 'Recovery: one small step', stat: 'INT', task: '10 minutes on your main study topic' },
  { title: 'Recovery: reset', stat: 'WIL', task: 'Tidy your desk and plan tomorrow (10 min)' },
  { title: 'Recovery: move a little', stat: 'STR', task: '10 minutes of stretching' },
  {
    title: 'Recovery: write it down',
    stat: 'WIL',
    task: 'Write 3 lines: what happened, one win, one next step',
  },
];

export function recoveryTemplateFor(day: DayString): RecoveryTemplate {
  const n = RECOVERY_QUESTS.length;
  const index = ((diffDays('2026-01-01', day) % n) + n) % n;
  return RECOVERY_QUESTS[index] ?? WALK;
}
