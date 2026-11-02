import { isEnabled } from '@/config/features';
import { ACHIEVEMENTS, type AchievementDef } from '@/data/achievements';

/**
 * Titles (SPEC 4.7): every unlocked achievement's name can be worn as the title shown on the
 * profile and Today. The profile stores the achievement key; the name comes from the data
 * file, so renaming an achievement there renames the title too.
 */
export function visibleAchievement(key: string | null | undefined): AchievementDef | null {
  if (!key) return null;
  const def = ACHIEVEMENTS.find((a) => a.key === key);
  return def && (!def.feature || isEnabled(def.feature)) ? def : null;
}

/** The displayed title's name, or null (none chosen, or no longer a known achievement). */
export function titleName(key: string | null | undefined): string | null {
  return visibleAchievement(key)?.name ?? null;
}
