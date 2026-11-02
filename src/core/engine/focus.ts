import { GAME } from '@/config/game';

/**
 * Focus sessions — "dungeons" (SPEC 4.6, 4.8), pure:
 * - a session linked to a quest gives no XP of its own: its minutes count toward the quest;
 * - a session not linked to a quest gives 1 XP per focused minute to the chosen stat
 *   (the daily soft cap still applies — it's an ordinary XP event);
 * - an abandoned session still counts the minutes actually focused toward a linked quest, but
 *   gives no XP of its own and no penalty.
 */

/** Whole minutes between two instants (never negative). */
export function elapsedMinutes(startedAt: string, endMs: number): number {
  return Math.max(0, Math.floor((endMs - Date.parse(startedAt)) / 60_000));
}

/**
 * Minutes that count: a completed session (the timer ran to the end) counts its planned
 * length; an abandoned one counts the minutes really focused, never more than planned.
 */
export function countedMinutes(input: {
  startedAt: string;
  endMs: number;
  plannedMin: number;
  completed: boolean;
}): number {
  if (input.completed) return input.plannedMin;
  return Math.min(input.plannedMin, elapsedMinutes(input.startedAt, input.endMs));
}

/** Base XP for an unlinked, completed session (soft cap applied later by the XP engine). */
export function unlinkedFocusXp(minutes: number): number {
  return Math.max(0, Math.round(minutes)) * GAME.unlinkedFocusXpPerMinute;
}

/** Where the timer is: focusing, on break, or finished (for the Focus screen). */
export function timerPhase(
  startedAt: string,
  nowMs: number,
  plannedMin: number,
  breakMin: number,
): { phase: 'work' | 'break' | 'over'; remainingMs: number } {
  const workEnd = Date.parse(startedAt) + plannedMin * 60_000;
  if (nowMs < workEnd) return { phase: 'work', remainingMs: workEnd - nowMs };
  const breakEnd = workEnd + breakMin * 60_000;
  if (nowMs < breakEnd) return { phase: 'break', remainingMs: breakEnd - nowMs };
  return { phase: 'over', remainingMs: 0 };
}
