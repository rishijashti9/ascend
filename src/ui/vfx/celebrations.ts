/**
 * When to celebrate (Phase 12 VFX) — looks only, never game rules. Pure, so it is tested
 * without a screen. A celebration only fires for a change seen while the app is open: the
 * first value a screen sees (startup, import, sync) is never "new".
 */

/** Streak lengths that get a moment of their own. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365, 500, 730, 1000] as const;

/** The milestone the streak just reached (it grew onto one), or null. */
export function streakMilestoneReached(prev: number | null, next: number): number | null {
  if (prev === null || next <= prev) return null;
  return (STREAK_MILESTONES as readonly number[]).includes(next) ? next : null;
}

/** True when the day turned into a Daily Clear while the app was open. */
export function dailyClearReached(prev: boolean | null, next: boolean): boolean {
  return prev === false && next;
}

/** How many particles a burst gets for an effects level (Off → none). */
export function particleCount(level: 'full' | 'light' | 'off', big: boolean): number {
  if (level === 'off') return 0;
  if (level === 'light') return big ? 8 : 5;
  return big ? 18 : 10;
}
