import { db as defaultDb, type AscendDB } from '@/core/db/db';
import { logError } from '@/core/errorLog';
import { recordAction, subscribeAll } from '@/core/pipeline';

/**
 * Checks achievements after things happen (SPEC 6.6: "Achievements → check unlock
 * conditions"). Bursts of events (a plan applying ten changes) cause one check, shortly after.
 */
export function startAchievements(database: AscendDB = defaultDb, delayMs = 400): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const check = async () => {
    timer = null;
    try {
      await recordAction(
        { type: 'achievements.check', source: 'system', payload: {} },
        { db: database },
      );
    } catch (error) {
      logError(error, 'achievements.check');
    }
  };
  const unsubscribe = subscribeAll((event) => {
    if (event.type === 'AchievementUnlocked') return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void check(), delayMs);
  });
  void check();
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
